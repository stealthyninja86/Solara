package com.solara.insightservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.solara.insightservice.dto.internal.RAGContext;
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
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
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
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

@Service
public class CategorizationService {

    private static final Logger log = LoggerFactory.getLogger(CategorizationService.class);

    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
            "createdAt", "updatedAt", "merchant", "amount", "category", "confidence", "paymentMode", "type"
    );

    private final CategorizedTransactionRepository transactionRepository;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final List<LLMStrategy> strategies;
    private final CategoryValidator categoryValidator;
    private final MerchantResolver merchantResolver;
    private final RAGContextBuilder ragContextBuilder;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final MeterRegistry meterRegistry;
    private final UserSettingsService userSettingsService;

    @Value("${app.cache.agent-ttl-seconds:86400}")
    private long baseTtl;

    public CategorizationService(CategorizedTransactionRepository transactionRepository,
                                 StringRedisTemplate redis,
                                 ObjectMapper objectMapper,
                                 CategorizationStrategy categorizationStrategy,
                                 CategoryValidator categoryValidator,
                                 MerchantResolver merchantResolver,
                                 RAGContextBuilder ragContextBuilder,
                                 KafkaTemplate<String, String> kafkaTemplate,
                                 MeterRegistry meterRegistry,
                                 UserSettingsService userSettingsService) {
        this.transactionRepository = transactionRepository;
        this.redis = redis;
        this.objectMapper = objectMapper;
        this.strategies = List.of(categorizationStrategy);
        this.categoryValidator = categoryValidator;
        this.merchantResolver = merchantResolver;
        this.ragContextBuilder = ragContextBuilder;
        this.kafkaTemplate = kafkaTemplate;
        this.meterRegistry = meterRegistry;
        this.userSettingsService = userSettingsService;
    }

    public AgentResult categorize(CategorizationInput input) {
        // 1. Redis cache — instant, no DB hit
        if (!input.isBulkImport() && input.normalizedMerchant() != null) {
            AgentResult cached = cacheGet(input.normalizedMerchant(), input.userId());
            if (cached != null) {
                recordOutcome("cache", "categorized");
                return cached;
            }
        }

        // 2. Merchant resolver — KB alias + per-user profile
        AgentResult resolved = merchantResolver.resolve(
                input.userId(), input.merchant(), input.normalizedMerchant());
        if (resolved != null) {
            recordOutcome("merchant-resolver", "categorized");
            return resolved;
        }

        // 3. Build RAG context — only when we have a merchant to query
        RAGContext ragContext = null;
        if (input.normalizedMerchant() != null) {
            ragContext = ragContextBuilder.build(
                    input.userId(), input.merchant(), input.normalizedMerchant());
        }
        CategorizationInput effectiveInput = ragContext != null
                ? input.withRAGContext(ragContext)
                : input;

        // 4. LLM strategy chain
        AgentResult rejected = null;
        for (LLMStrategy strategy : activeStrategiesFor(input.userId())) {
            String strategyName = strategy.getClass().getSimpleName();
            try {
                Timer.Sample sample = Timer.start(meterRegistry);
                AgentResult result = strategy.execute(effectiveInput);
                sample.stop(meterRegistry.timer("solara.llm.categorization.duration", "strategy", strategyName));
                if (result == null || result.category() == null) {
                    recordOutcome(strategyName, "uncategorized");
                    continue;
                }
                rejected = result;
                AgentResult validated = categoryValidator.validate(result, narrationFor(input));
                if (validated != null) {
                    if (!input.isBulkImport() && input.normalizedMerchant() != null) {
                        cacheSet(input.normalizedMerchant(), input.userId(), validated);
                    }
                    recordOutcome(strategyName, "categorized");
                    log.debug("{} categorized merchant={} as {}",
                            strategy.getClass().getSimpleName(), input.merchant(), validated.category());
                    return validated;
                }
            } catch (Exception e) {
                recordOutcome(strategyName, "failed");
                log.warn("{} failed for merchant={}: {}",
                        strategy.getClass().getSimpleName(), input.merchant(), e.getMessage());
            }
        }
        if (rejected != null) {
            log.debug("Returning rejected result coerced to OTHER for merchant={}", input.merchant());
            return new AgentResult(TransactionCategory.OTHER, rejected.confidence(), rejected.method(),
                    rejected.merchant(), rejected.description(), true);
        }
        return null;
    }

    /**
     * Classifies many transactions in one pass. Each strategy in the chain is given the
     * inputs the previous one could not classify (batch miss-propagation, mirroring the
     * single-item chain). Batch-capable strategies group the misses into a single LLM call.
     *
     * @return results aligned by index with {@code inputs}; null where an item was not classified
     */
    public List<AgentResult> categorizeBatch(List<CategorizationInput> inputs) {
        List<AgentResult> results = new ArrayList<>(Collections.nCopies(inputs.size(), null));
        List<LLMStrategy> activeStrategies = batchStrategiesFor(inputs);
        for (LLMStrategy strategy : activeStrategies) {
            List<Integer> missIndices = IntStream.range(0, results.size())
                    .filter(i -> results.get(i) == null)
                    .boxed()
                    .toList();
            if (missIndices.isEmpty()) {
                break;
            }
            List<CategorizationInput> misses = missIndices.stream().map(inputs::get).toList();
            List<AgentResult> strategyResults = executeStrategyBatch(strategy, misses);
            for (int i = 0; i < missIndices.size(); i++) {
                results.set(missIndices.get(i), strategyResults.get(i));
            }
        }
        return results;
    }

    /**
     * Prunes the strategy chain for a single user: when smart (LLM) categorization is
     * disabled, only strategies that do not invoke an LLM (the cache) run. Unknown
     * merchants then fall through to {@code needsReview} instead of incurring LLM cost.
     */
    private List<LLMStrategy> activeStrategiesFor(UUID userId) {
        if (userSettingsService.isLlmEnabled(userId)) {
            return strategies;
        }
        return strategies.stream().filter(strategy -> !strategy.usesLlm()).toList();
    }

    /**
     * Batch variant: bulk imports are single-user, so one gate covers the whole batch.
     * In the unlikely mixed-user case the strictest setting wins (LLM disabled if any
     * user in the batch has it off) — documented rather than solved: per-item pruning
     * would defeat the purpose of a single batched LLM call.
     */
    private List<LLMStrategy> batchStrategiesFor(List<CategorizationInput> inputs) {
        boolean llmAllowed = inputs.stream().allMatch(input -> userSettingsService.isLlmEnabled(input.userId()));
        if (llmAllowed) {
            return strategies;
        }
        return strategies.stream().filter(strategy -> !strategy.usesLlm()).toList();
    }

    private List<AgentResult> executeStrategyBatch(LLMStrategy strategy, List<CategorizationInput> inputs) {
        List<CategorizationInput> enriched = inputs.stream()
                .map(input -> {
                    if (input.normalizedMerchant() == null) {
                        return input;
                    }
                    RAGContext ragContext = ragContextBuilder.build(
                            input.userId(), input.merchant(), input.normalizedMerchant());
                    return ragContext != null ? input.withRAGContext(ragContext) : input;
                })
                .toList();

        Timer.Sample sample = Timer.start(meterRegistry);
        List<AgentResult> rawResults = strategy.executeBatch(enriched);
        sample.stop(meterRegistry.timer("solara.llm.categorization.duration",
                "strategy", strategy.getClass().getSimpleName()));

        if (rawResults == null) {
            return inputs.stream().map(input -> finalizeBatchResult(strategy, input, null)).toList();
        }
        return IntStream.range(0, inputs.size())
                .mapToObj(i -> finalizeBatchResult(strategy, inputs.get(i),
                        i < rawResults.size() ? rawResults.get(i) : null))
                .toList();
    }

    private AgentResult finalizeBatchResult(LLMStrategy strategy, CategorizationInput input, AgentResult result) {
        if (result == null || result.category() == null) {
            recordOutcome(strategy.getClass().getSimpleName(), "uncategorized");
            return result;
        }
        AgentResult validated = categoryValidator.validate(result, narrationFor(input));
        if (validated == null) {
            recordOutcome(strategy.getClass().getSimpleName(), "uncategorized");
            return new AgentResult(TransactionCategory.OTHER, result.confidence(), result.method(),
                    result.merchant(), result.description(), true);
        }
        if (!input.isBulkImport() && input.normalizedMerchant() != null) {
            cacheSet(input.normalizedMerchant(), input.userId(), validated);
        }
        recordOutcome(strategy.getClass().getSimpleName(), "categorized");
        return validated;
    }

    private void recordOutcome(String strategyName, String outcome) {
        meterRegistry.counter("solara.categorization.outcome",
                "strategy", strategyName, "outcome", outcome).increment();
    }

    /**
     * The raw narration the LLM's merchant must be grounded in — the anti-hallucination
     * evidence check now runs on BOTH paths, not just bulk imports. Bulk-import rows
     * carry the narration in description; single-path entries carry it in merchant
     * (the raw bank string, or the user-entered name for manual adds). When merchant is
     * null the validator skips grounding, exactly as before.
     */
    private String narrationFor(CategorizationInput input) {
        return input.isBulkImport() ? input.description() : input.merchant();
    }

    public void publishCategorized(CategorizedTransaction transaction, String previousNormalizedMerchant) {
        if (transaction.getCategory() == null
                || transaction.getCategory() == TransactionCategory.UNCATEGORIZED) {
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
                                             Boolean bulkImport,
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

        if (Boolean.TRUE.equals(bulkImport)) {
            spec = spec.and(TransactionSpecifications.isBulkImport(true));
        } else if (Boolean.FALSE.equals(bulkImport)) {
            spec = spec.and(TransactionSpecifications.isBulkImport(false));
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

        publishCategorized(saved, null);

        log.info("Recategorized transaction {} to {} (manual)", id, newCategory);
        return saved;
    }

    @Transactional
    public void delete(UUID id) {
        CategorizedTransaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found: " + id));

        UUID userId = transaction.getUserId();
        String normalized = CategorizedTransaction.normalizeMerchant(transaction.getMerchant());

        transactionRepository.delete(transaction);

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
        if (request.description() != null && !request.description().isBlank()) {
            transaction.setDescription(request.description());
        }
        if (request.category() != null && !request.category().equals(transaction.getCategory())) {
            transaction.setCategory(request.category());
            transaction.setCategorizationMethod("manual");
            transaction.setConfidence(null);
            transaction.setNeedsReview(false);
        }
        if (request.needsReview() != null) {
            transaction.setNeedsReview(request.needsReview());
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
