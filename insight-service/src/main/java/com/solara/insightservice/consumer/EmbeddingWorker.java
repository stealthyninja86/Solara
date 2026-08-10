package com.solara.insightservice.consumer;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.solara.insightservice.dto.event.TransactionCategorizedEvent;
import com.solara.insightservice.dto.event.TransactionCategorizedEventPayload;
import com.solara.insightservice.model.MerchantKnowledgeBase;
import com.solara.insightservice.model.ProcessedEvent;
import com.solara.insightservice.model.TransactionCategory;
import com.solara.insightservice.repository.MerchantKnowledgeBaseRepository;
import com.solara.insightservice.repository.MerchantProfileRepository;
import com.solara.insightservice.repository.ProcessedEventRepository;
import com.solara.insightservice.service.categorization.MerchantResolver;
import com.solara.insightservice.util.VectorLiterals;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Set;

@Component
public class EmbeddingWorker {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingWorker.class);

    private final ObjectMapper objectMapper;
    private final ProcessedEventRepository processedEventRepository;
    private final MerchantProfileRepository merchantProfileRepository;
    private final MerchantKnowledgeBaseRepository knowledgeBaseRepository;
    private final MerchantResolver merchantResolver;
    private final EmbeddingModel embeddingModel;

    public EmbeddingWorker(ObjectMapper objectMapper,
                           ProcessedEventRepository processedEventRepository,
                           MerchantProfileRepository merchantProfileRepository,
                           MerchantKnowledgeBaseRepository knowledgeBaseRepository,
                           MerchantResolver merchantResolver,
                           EmbeddingModel embeddingModel) {
        this.objectMapper = objectMapper;
        this.processedEventRepository = processedEventRepository;
        this.merchantProfileRepository = merchantProfileRepository;
        this.knowledgeBaseRepository = knowledgeBaseRepository;
        this.merchantResolver = merchantResolver;
        this.embeddingModel = embeddingModel;
    }

    @RetryableTopic(
            attempts = "3",
            dltTopicSuffix = ".dlq",
            exclude = {JsonProcessingException.class, DataIntegrityViolationException.class}
    )
    @KafkaListener(topics = "transaction.categorized.v1",
            containerFactory = "kafkaListenerContainerFactory",
            groupId = "insight-embedding-worker")
    public void onEvent(ConsumerRecord<String, String> record, Acknowledgment ack) {
        long start = System.currentTimeMillis();
        try {
            TransactionCategorizedEvent event =
                    objectMapper.readValue(record.value(), TransactionCategorizedEvent.class);

            if (!claim(event)) {
                if (workAlreadyDone(event)) {
                    log.debug("Categorized event already processed, acking: eventId={}", event.eventId());
                    ack.acknowledge();
                    return;
                }
                reclaim(event);
            }

            TransactionCategorizedEventPayload payload = event.payload();
            if (payload.previousMerchant() != null && !payload.previousMerchant().isBlank()) {
                merchantProfileRepository.deleteByUserIdAndNormalizedMerchant(
                        payload.userId(), payload.previousMerchant());
            }
            upsertProfile(payload);

            ack.acknowledge();
            log.debug("Embedding worker processed event: eventId={}, method={}, merchant={}, category={}, "
                            + "learnedAlias={}, durationMs={}",
                    event.eventId(), payload.method(), payload.merchant(), payload.category(),
                    canLearn(payload), System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.error("Embedding worker failed: eventId={}, error={}", getEventId(record.value()), e.getMessage(), e);
            throw new RuntimeException(e);
        }
    }

    private boolean claim(TransactionCategorizedEvent event) {
        try {
            processedEventRepository.save(new ProcessedEvent(
                    event.eventId(), event.eventType(), "insight-embedding-worker"));
            return true;
        } catch (DataIntegrityViolationException e) {
            return false;
        }
    }

    private boolean workAlreadyDone(TransactionCategorizedEvent event) {
        TransactionCategorizedEventPayload payload = event.payload();
        String normalizedMerchant = payload.normalizedMerchant() != null
                ? payload.normalizedMerchant() : payload.merchant();
        return merchantProfileRepository
                .findByUserIdAndNormalizedMerchant(payload.userId(), normalizedMerchant)
                .isPresent();
    }

    private void reclaim(TransactionCategorizedEvent event) {
        log.warn("Stale claim detected, re-processing: eventId={}, eventType={}",
                event.eventId(), event.eventType());
        processedEventRepository.deleteById(event.eventId());
        processedEventRepository.save(new ProcessedEvent(
                event.eventId(), event.eventType(), "insight-embedding-worker"));
    }

    private String getEventId(String raw) {
        try {
            return objectMapper.readTree(raw).path("eventId").asText();
        } catch (Exception ignored) {
            return "unknown";
        }
    }

    private void upsertProfile(TransactionCategorizedEventPayload payload) {
        if (payload.category() == null) {
            return;
        }
        TransactionCategory category = TransactionCategory.valueOf(payload.category());
        String normalizedMerchant = payload.normalizedMerchant() != null
                ? payload.normalizedMerchant() : payload.merchant();
        String embedText = payload.merchant()
                + (payload.description() != null ? " " + payload.description() : "");
        long start = System.currentTimeMillis();
        float[] embedding = embeddingModel.embed(embedText);

        merchantProfileRepository.upsert(
                payload.userId(), payload.merchant(), normalizedMerchant,
                payload.description(), category.name(), VectorLiterals.toPostgresLiteral(embedding)
        );
        log.debug("Profile upserted: userId={}, merchant={}, normalizedMerchant={}, category={}, embedDurationMs={}",
                payload.userId(), payload.merchant(), normalizedMerchant, category.name(),
                System.currentTimeMillis() - start);

        learnAlias(payload);
    }

    private static final BigDecimal LEARN_THRESHOLD = new BigDecimal("0.85");
    private static final BigDecimal MANUAL_CORRECTION_CONFIDENCE = new BigDecimal("0.90");

    // Generic personal-finance terms are not merchants — learning them into the
    // global KB mislabels every transaction from such a payee (e.g. a landlord
    // named "rent" poisoned the KB with OTHER). The LLM prompt already forbids
    // inventing business names; this guard applies the same standard to the learner.
    private static final Set<String> GENERIC_ALIASES = Set.of(
            "rent", "mortgage", "salary", "wages", "transfer", "withdrawal", "deposit",
            "interest", "fee", "fees", "charge", "charges", "cash", "atm", "refund",
            "bill", "bills", "payment", "payments", "emi", "loan", "insurance",
            "tax", "taxes", "recharge", "wallet", "topup", "upi", "draft");

    private boolean canLearn(TransactionCategorizedEventPayload payload) {
        String alias = merchantResolver.normalize(payload.merchant());
        if (alias.isBlank() || GENERIC_ALIASES.contains(alias)) {
            return false;
        }
        BigDecimal confidence = payload.confidence();
        if (confidence == null) {
            return "manual".equals(payload.method());
        }
        return confidence.compareTo(LEARN_THRESHOLD) >= 0;
    }

    private void learnAlias(TransactionCategorizedEventPayload payload) {
        String alias = merchantResolver.normalize(payload.merchant());
        if (alias.isBlank() || GENERIC_ALIASES.contains(alias)) {
            return;
        }
        BigDecimal confidence = payload.confidence();
        if (confidence == null) {
            // Manual recategorization/update carries no confidence — a human decision is
            // the strongest evidence we have, so learn it with a fixed high trust. The
            // old code NPE'd here, tripped retry ×3 → DLQ, and the @Transactional
            // rollback silently dropped the correction (profile + KB never updated).
            if (!"manual".equals(payload.method())) {
                return;
            }
            confidence = MANUAL_CORRECTION_CONFIDENCE;
        }
        if (confidence.compareTo(LEARN_THRESHOLD) < 0) {
            return;
        }
        knowledgeBaseRepository.upsert(alias, payload.merchant(), payload.category(), confidence);
        log.info("KB learned alias: '{}' → merchant={}, category={}, confidence={}",
                alias, payload.merchant(), payload.category(), confidence);
    }

    @DltHandler
    public void onDlt(ConsumerRecord<String, String> record, Acknowledgment ack) {
        log.error("Categorized event sent to DLQ: topic={}, key={}, eventId={}, eventType={}",
                record.topic(), record.key(), getEventId(record.value()), getEventType(record.value()));
        ack.acknowledge();
    }

    private String getEventType(String raw) {
        try {
            return objectMapper.readTree(raw).path("eventType").asText("unknown");
        } catch (Exception ignored) {
            return "unknown";
        }
    }
}