package com.solara.insightservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.solara.insightservice.dto.event.TransactionCategorizedEvent;
import com.solara.insightservice.dto.event.TransactionCategorizedEventPayload;
import com.solara.insightservice.dto.request.CategorizationInput;
import com.solara.insightservice.dto.request.UpdateTransactionRequest;
import com.solara.insightservice.dto.response.AgentResult;
import com.solara.insightservice.model.CategorizedTransaction;
import com.solara.insightservice.model.TransactionCategory;
import com.solara.insightservice.repository.CategorizedTransactionRepository;
import com.solara.insightservice.repository.TransactionSpecifications;
import com.solara.insightservice.service.strategy.LLMStrategy;
import com.solara.insightservice.service.strategy.categorization.CategorizationStrategy;
import com.solara.insightservice.service.strategy.categorization.CategoryValidator;
import com.solara.insightservice.service.strategy.categorization.MerchantCache;
import com.solara.insightservice.service.strategy.categorization.RAGContextRetriever;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;

@Service
public class CategorizationService {

    private static final Logger log = LoggerFactory.getLogger(CategorizationService.class);

    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
            "createdAt", "updatedAt", "merchant", "amount", "category", "confidence", "paymentMode", "type"
    );

    private final CategorizedTransactionRepository transactionRepository;
    private final ProjectionService projectionService;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final List<LLMStrategy> strategies;
    private final CategoryValidator categoryValidator;
    private final RAGContextRetriever ragContextRetriever;
    private final KafkaTemplate<String, String> kafkaTemplate;

    @Value("${app.cache.agent-ttl-seconds:86400}")
    private long baseTtl;

    public CategorizationService(CategorizedTransactionRepository transactionRepository,
                                 ProjectionService projectionService,
                                 StringRedisTemplate redis,
                                 ObjectMapper objectMapper,
                                 MerchantCache merchantCache,
                                 CategorizationStrategy categorizationStrategy,
                                 CategoryValidator categoryValidator,
                                 RAGContextRetriever ragContextRetriever,
                                 KafkaTemplate<String, String> kafkaTemplate) {
        this.transactionRepository = transactionRepository;
        this.projectionService = projectionService;
        this.redis = redis;
        this.objectMapper = objectMapper;
        this.strategies = List.of(merchantCache, categorizationStrategy);
        this.categoryValidator = categoryValidator;
        this.ragContextRetriever = ragContextRetriever;
        this.kafkaTemplate = kafkaTemplate;
    }

    public AgentResult categorize(CategorizationInput input) {
        AgentResult rejected = null;
        for (LLMStrategy strategy : strategies) {
            try {
                CategorizationInput effectiveInput = input;
                if (strategy instanceof CategorizationStrategy) {
                    effectiveInput = input.withExamples(ragContextRetriever.findSimilar(
                            input.userId(), input.merchant(), input.normalizedMerchant(), input.isBulkImport()));
                }
                AgentResult result = strategy.execute(effectiveInput);
                if (result == null || result.category() == null) {
                    continue;
                }
                rejected = result;
                AgentResult validated = categoryValidator.validate(result,
                        input.isBulkImport() ? input.description() : null);
                if (validated != null) {
                    if (!input.isBulkImport() && input.normalizedMerchant() != null) {
                        cacheSet(input.normalizedMerchant(), input.userId(), validated);
                    }
                    log.debug("{} categorized merchant={} as {}",
                            strategy.getClass().getSimpleName(), input.merchant(), validated.category());
                    return validated;
                }
            } catch (Exception e) {
                log.warn("{} failed for merchant={}: {}",
                        strategy.getClass().getSimpleName(), input.merchant(), e.getMessage());
            }
        }
        if (rejected != null) {
            log.debug("Returning rejected result with null category for merchant={}", input.merchant());
            return new AgentResult(null, rejected.confidence(), rejected.method(),
                    rejected.merchant(), rejected.description());
        }
        return null;
    }

    public void publishCategorized(CategorizedTransaction transaction, String previousNormalizedMerchant) {
        if (transaction.getCategory() == null) {
            return;
        }
        try {
            TransactionCategorizedEventPayload payload = new TransactionCategorizedEventPayload(
                    transaction.getTransactionId(),
                    transaction.getUserId(),
                    transaction.getMerchant(),
                    transaction.getNormalizedMerchant(),
                    transaction.getOriginalDescription(),
                    transaction.getCategory().name(),
                    transaction.getConfidence(),
                    transaction.getCategorizationMethod(),
                    previousNormalizedMerchant
            );
            TransactionCategorizedEvent event = TransactionCategorizedEvent.of(payload);
            String json = objectMapper.writeValueAsString(event);

            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        sendCategorizedEvent(event, json);
                    }
                });
            } else {
                sendCategorizedEvent(event, json);
            }
        } catch (Exception e) {
            log.warn("Failed to publish categorized event for transaction {}: {}",
                    transaction.getTransactionId(), e.getMessage());
        }
    }

    private void sendCategorizedEvent(TransactionCategorizedEvent event, String json) {
        kafkaTemplate.send("transaction.categorized.v1", event.payload().userId().toString(), json);
    }

    public Page<CategorizedTransaction> list(UUID userId, Boolean needsReview, String category,
                                             LocalDate dateFrom, LocalDate dateTo,
                                             String paymentMode, BigDecimal amountMin, BigDecimal amountMax,
                                             LocalDate updatedAtFrom, LocalDate updatedAtTo,
                                             Pageable pageable) {
        Specification<CategorizedTransaction> spec = Specification.where(TransactionSpecifications.forUser(userId));

        if (Boolean.TRUE.equals(needsReview)) {
            spec = spec.and(TransactionSpecifications.needsReview());
        }

        if (category != null) {
            if ("null".equals(category)) {
                spec = spec.and(TransactionSpecifications.uncategorized());
            } else {
                spec = spec.and(TransactionSpecifications.hasCategory(category));
            }
        }

        if (paymentMode != null && !paymentMode.isBlank()) {
            spec = spec.and(TransactionSpecifications.hasPaymentMode(paymentMode));
        }

        if (amountMin != null || amountMax != null) {
            spec = spec.and(TransactionSpecifications.amountBetween(amountMin, amountMax));
        }

        if (dateFrom != null || dateTo != null) {
            Instant from = dateFrom != null ? dateFrom.atStartOfDay(ZoneOffset.UTC).toInstant() : null;
            Instant to = dateTo != null ? dateTo.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant() : null;
            spec = spec.and(TransactionSpecifications.createdBetween(from, to));
        }

        if (updatedAtFrom != null || updatedAtTo != null) {
            Instant from = updatedAtFrom != null ? updatedAtFrom.atStartOfDay(ZoneOffset.UTC).toInstant() : null;
            Instant to = updatedAtTo != null ? updatedAtTo.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant() : null;
            spec = spec.and(TransactionSpecifications.updatedBetween(from, to));
        }

        return transactionRepository.findAll(spec, sanitizeSort(pageable));
    }

    private Pageable sanitizeSort(Pageable pageable) {
        if (!pageable.getSort().isSorted()) {
            return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                    Sort.by(Sort.Direction.DESC, "createdAt"));
        }
        List<Sort.Order> safeOrders = pageable.getSort().stream()
                .filter(order -> ALLOWED_SORT_FIELDS.contains(order.getProperty()))
                .toList();
        if (safeOrders.isEmpty()) {
            return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                    Sort.by(Sort.Direction.DESC, "createdAt"));
        }
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by(safeOrders));
    }

    public Optional<CategorizedTransaction> get(UUID id) {
        return transactionRepository.findById(id);
    }

    @Transactional
    public CategorizedTransaction recategorize(UUID id, TransactionCategory newCategory) {
        CategorizedTransaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found: " + id));

        UUID userId = transaction.getUserId();

        transaction.setCategory(newCategory);
        transaction.setCategorizationMethod("manual");
        transaction.setConfidence(null);
        transaction.setNeedsReview(false);

        CategorizedTransaction saved = transactionRepository.save(transaction);

        String normalized = CategorizedTransaction.normalizeMerchant(transaction.getMerchant());
        if (normalized != null) {
            cacheInvalidate(normalized, userId);
        }

        if (saved.getCategory() != null) {
            projectionService.upsertAll(userId, saved.getCategory(), saved.getAmount(),
                    saved.getCreatedAt(), saved.getType());
        }

        publishCategorized(saved, null);

        log.info("Recategorized transaction {} to {} (manual)", id, newCategory);
        return saved;
    }

    @Transactional
    public void delete(UUID id) {
        CategorizedTransaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found: " + id));

        UUID userId = transaction.getUserId();
        TransactionCategory category = transaction.getCategory();
        String normalized = CategorizedTransaction.normalizeMerchant(transaction.getMerchant());

        transactionRepository.delete(transaction);

        if (category != null) {
            projectionService.upsertAll(userId, category, transaction.getAmount().negate(),
                    transaction.getCreatedAt(), transaction.getType());
        }

        if (normalized != null) {
            cacheInvalidate(normalized, userId);
        }

        log.info("Deleted categorized transaction {} (userId={})", id, userId);
    }

    @Transactional
    public CategorizedTransaction update(UUID id, UpdateTransactionRequest request) {
        CategorizedTransaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found: " + id));

        String oldNormalized = CategorizedTransaction.normalizeMerchant(transaction.getMerchant());

        if (request.merchant() != null && !request.merchant().isBlank()) {
            transaction.setMerchant(request.merchant());
        }
        if (request.originalDescription() != null && !request.originalDescription().isBlank()) {
            transaction.setOriginalDescription(request.originalDescription());
        }
        if (request.category() != null && !request.category().equals(transaction.getCategory())) {
            TransactionCategory oldCategory = transaction.getCategory();
            if (oldCategory != null) {
                projectionService.upsertAll(transaction.getUserId(), oldCategory,
                        transaction.getAmount().negate(), transaction.getCreatedAt(),
                        transaction.getType());
            }

            transaction.setCategory(request.category());
            transaction.setCategorizationMethod("manual");
            transaction.setConfidence(null);
            transaction.setNeedsReview(false);

            projectionService.upsertAll(transaction.getUserId(), request.category(),
                    transaction.getAmount(), transaction.getCreatedAt(), transaction.getType());
        }

        String newNormalized = CategorizedTransaction.normalizeMerchant(transaction.getMerchant());
        if (oldNormalized != null) {
            cacheInvalidate(oldNormalized, transaction.getUserId());
        }

        CategorizedTransaction saved = transactionRepository.save(transaction);

        publishCategorized(saved, oldNormalized);

        log.info("Updated transaction {} (merchant={}, category={})", id, saved.getMerchant(), saved.getCategory());
        return saved;
    }

    public AgentResult cacheGet(String normalizedMerchant, UUID userId) {
        String key = cacheKey(normalizedMerchant, userId);
        String value = redis.opsForValue().get(key);
        if (value == null) return null;
        try {
            return objectMapper.readValue(value, AgentResult.class);
        } catch (Exception e) {
            return null;
        }
    }

    public void cacheSet(String normalizedMerchant, UUID userId, AgentResult result) {
        try {
            String key = cacheKey(normalizedMerchant, userId);
            String value = objectMapper.writeValueAsString(result);
            redis.opsForValue().set(key, value, jitteredTtl(), TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("Failed to cache agent result: {}", e.getMessage());
        }
    }

    public void cacheInvalidate(String normalizedMerchant, UUID userId) {
        String key = cacheKey(normalizedMerchant, userId);
        redis.delete(key);
        log.debug("Invalidated cache key: {}", key);
    }

    private String cacheKey(String normalizedMerchant, UUID userId) {
        return "agent:cat:" + normalizedMerchant + ":" + userId;
    }

    private long jitteredTtl() {
        long jitter = ThreadLocalRandom.current().nextLong(-(baseTtl / 5), baseTtl / 5);
        return baseTtl + jitter;
    }
}
