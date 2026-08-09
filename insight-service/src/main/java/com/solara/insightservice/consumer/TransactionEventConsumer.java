package com.solara.insightservice.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.solara.insightservice.dto.response.AgentResult;
import com.solara.insightservice.dto.request.CategorizationInput;
import com.solara.insightservice.model.CategorizedTransaction;
import com.solara.insightservice.model.ProcessedEvent;
import com.solara.insightservice.model.TransactionCategory;
import com.solara.insightservice.dto.event.TransactionEvent;
import com.solara.insightservice.dto.event.TransactionEventPayload;
import com.solara.insightservice.repository.CategorizedTransactionRepository;
import com.solara.insightservice.repository.ProcessedEventRepository;
import com.solara.insightservice.service.CategorizationService;
import com.solara.insightservice.service.SubscriptionService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class TransactionEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(TransactionEventConsumer.class);

    private final CategorizedTransactionRepository categorizedTransactionRepository;
    private final ProcessedEventRepository processedEventRepository;
    private final CategorizationService categorizationService;
    private final SubscriptionService subscriptionService;
    private final ObjectMapper objectMapper;
    private final boolean skipAi;

    public TransactionEventConsumer(CategorizedTransactionRepository categorizedTransactionRepository,
                                    ProcessedEventRepository processedEventRepository,
                                    CategorizationService categorizationService,
                                    SubscriptionService subscriptionService,
                                    ObjectMapper objectMapper,
                                    @Value("${app.categorization.skip-ai:false}") boolean skipAi) {
        this.categorizedTransactionRepository = categorizedTransactionRepository;
        this.processedEventRepository = processedEventRepository;
        this.categorizationService = categorizationService;
        this.subscriptionService = subscriptionService;
        this.objectMapper = objectMapper;
        this.skipAi = skipAi;
    }

    @RetryableTopic(
            attempts = "3",
            dltTopicSuffix = ".dlq",
            exclude = {DataIntegrityViolationException.class}
    )
    @KafkaListener(topics = "transaction.events", containerFactory = "kafkaListenerContainerFactory")
    public void onEvent(ConsumerRecord<String, String> record, Acknowledgment ack) {
        long start = System.currentTimeMillis();
        try {
            TransactionEvent event = objectMapper.readValue(record.value(), TransactionEvent.class);

            if (!claim(event)) {
                if (workAlreadyDone(event)) {
                    log.debug("Event already processed, acking: eventId={}, eventType={}",
                            event.eventId(), event.eventType());
                    ack.acknowledge();
                    return;
                }
                reclaim(event);
            }

            switch (event.eventType()) {
                case "transaction.created.v1", "transaction.updated.v1" ->
                        handleCreatedOrUpdated(event);
                case "transaction.deleted.v1" ->
                        handleDeleted(event);
                case "bulk.import.completed.v1" ->
                        log.debug("Bulk import completion event skipped (frontend polls job status): eventId={}",
                                event.eventId());
                default ->
                        log.warn("Unknown event type: {}", event.eventType());
            }

            ack.acknowledge();
            log.debug("Event processed: eventId={}, eventType={}, durationMs={}",
                    event.eventId(), event.eventType(), System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.error("Error processing event on topic {} (key={}): {}",
                    record.topic(), record.key(), e.getMessage(), e);
            throw new RuntimeException(e);
        }
    }

    /**
     * Claims the event idempotently. The claim is its own short transaction —
     * the LLM categorization below must never hold a DB transaction open
     * (previously the whole handler ran inside one {@code @Transactional},
     * pinning a connection for 10-30s per LLM call).
     *
     * @return true if this attempt made the claim; false if a claim already exists
     */
    private boolean claim(TransactionEvent event) {
        try {
            processedEventRepository.save(new ProcessedEvent(event.eventId(), event.eventType()));
            return true;
        } catch (DataIntegrityViolationException e) {
            return false;
        }
    }

    /**
     * Reconciles a duplicate claim: the claim row alone is not proof the work
     * completed — a crash between claim and save leaves a stale row that would
     * otherwise skip a never-processed event forever. The artifact of a completed
     * create/update is the categorized transaction itself; for a delete it is
     * the transaction's absence.
     */
    private boolean workAlreadyDone(TransactionEvent event) {
        UUID transactionId = event.payload().transactionId();
        boolean transactionExists = categorizedTransactionRepository.existsById(transactionId);
        return switch (event.eventType()) {
            case "transaction.created.v1", "transaction.updated.v1" -> transactionExists;
            case "transaction.deleted.v1" -> !transactionExists;
            default -> true;
        };
    }

    /**
     * Clears a stale claim left by a failed attempt (claim committed, work never
     * finished) and re-claims, so the Kafka retry chain can re-run the handler.
     */
    private void reclaim(TransactionEvent event) {
        log.warn("Stale claim detected, re-processing: eventId={}, eventType={}",
                event.eventId(), event.eventType());
        processedEventRepository.deleteById(event.eventId());
        processedEventRepository.save(new ProcessedEvent(event.eventId(), event.eventType()));
    }

    private void handleCreatedOrUpdated(TransactionEvent event) {
        TransactionEventPayload payload = event.payload();

        CategorizedTransaction transaction = new CategorizedTransaction(
                payload.transactionId(), payload.userId(), payload.merchant(),
                payload.description(), payload.amount(), payload.currency()
        );
        transaction.setPaymentMode(payload.paymentMode());
        transaction.setType(payload.type());
        transaction.setCreatedAt(payload.timestamp());
        transaction.setBulkImport(payload.isBulkImport());
        transaction.setDescription(payload.description());

        if (skipAi) {
            transaction.setCategory(TransactionCategory.UNCATEGORIZED);
            transaction.setNeedsReview(true);
            CategorizedTransaction saved = categorizedTransactionRepository.save(transaction);
            trackChargeIfDebit(saved);
            log.debug("AI categorization skipped (skip-ai=true), saved uncategorized transaction={}", payload.transactionId());
            return;
        }

        CategorizationInput input = new CategorizationInput(
                payload.merchant(),
                CategorizedTransaction.normalizeMerchant(payload.merchant()),
                payload.description(), payload.amount(), payload.userId(), payload.isBulkImport()
        );

        long categorizeStart = System.currentTimeMillis();
        AgentResult result = categorizationService.categorize(input);
        boolean categorized = result != null && result.category() != null;
        log.debug("Categorization for transaction={}: merchant={}, categorized={}, method={}, category={}, confidence={}, "
                        + "durationMs={}",
                payload.transactionId(), input.normalizedMerchant(), categorized,
                result != null ? result.method() : null,
                result != null ? result.category() : null,
                result != null ? result.confidence() : null,
                System.currentTimeMillis() - categorizeStart);

        if (result != null && result.category() != null) {
            applyCategory(transaction, result);
            if (payload.isBulkImport()) {
                if (result.merchant() != null) {
                    transaction.setMerchant(result.merchant());
                }
                if (result.description() != null) {
                    transaction.setDescription(result.description());
                }
            } else if ((transaction.getDescription() == null || transaction.getDescription().isBlank())
                    && result.description() != null) {
                transaction.setDescription(result.description());
            }
            log.debug("Categorized merchant={} as {} via {}",
                    input.normalizedMerchant(), result.category(), result.method());
        } else {
            log.info("Could not categorize merchant={}, saving uncategorized", input.normalizedMerchant());
            transaction.setCategory(TransactionCategory.UNCATEGORIZED);
            transaction.setNeedsReview(true);
            if (result != null) {
                if (result.merchant() != null) {
                    transaction.setMerchant(result.merchant());
                }
                if (result.description() != null
                        && (payload.isBulkImport() || transaction.getDescription() == null
                        || transaction.getDescription().isBlank())) {
                    transaction.setDescription(result.description());
                }
                if (result.confidence() != null) {
                    transaction.setConfidence(result.confidence());
                }
            }
        }

        finishTransaction(transaction);
    }

    private void finishTransaction(CategorizedTransaction transaction) {
        if ((transaction.getMerchant() == null || transaction.getMerchant().isBlank())
                && transaction.getOriginalDescription() != null) {
            String narration = transaction.getOriginalDescription();
            transaction.setMerchant(narration.length() > 200 ? narration.substring(0, 200) : narration);
        }
        CategorizedTransaction saved = categorizedTransactionRepository.save(transaction);

        trackChargeIfDebit(saved);

        if (saved.getCategory() != null) {
            categorizationService.publishCategorized(saved, null);
        }
    }

    private void trackChargeIfDebit(CategorizedTransaction saved) {
        if (!"DEBIT".equalsIgnoreCase(saved.getType())) {
            return;
        }
        try {
            subscriptionService.matchCharge(saved);
        } catch (Exception e) {
            // The transaction write is the source of truth; a subscription matcher hiccup must
            // never fail categorization or poison the retry/DLQ machinery for a legit event.
            // Match against the next relevant charge window instead.
            log.warn("Subscription charge matching failed for transaction {} (skipping): {}",
                    saved.getTransactionId(), e.getMessage());
        }
    }

    private void handleDeleted(TransactionEvent event) {
        UUID transactionId = event.payload().transactionId();
        try {
            categorizationService.delete(transactionId);
        } catch (IllegalArgumentException e) {
            log.debug("Categorized transaction not found for deletion: {}", transactionId);
        }
    }

    private void applyCategory(CategorizedTransaction transaction, AgentResult result) {
        transaction.setCategory(result.category());
        transaction.setConfidence(result.confidence());
        transaction.setCategorizationMethod(result.method());
        transaction.setNeedsReview(result.needsReview());
        transaction.setSubscription(false);
    }

    @DltHandler
    public void onDlt(ConsumerRecord<String, String> record, Acknowledgment ack) {
        log.error("Event sent to DLQ: topic={}, key={}, eventId={}, eventType={}",
                record.topic(), record.key(), extractEventId(record.value()), extractEventType(record.value()));
        ack.acknowledge();
    }

    private String extractEventId(String raw) {
        try {
            return objectMapper.readTree(raw).path("eventId").asText("unknown");
        } catch (Exception ignored) {
            return "unknown";
        }
    }

    private String extractEventType(String raw) {
        try {
            return objectMapper.readTree(raw).path("eventType").asText("unknown");
        } catch (Exception ignored) {
            return "unknown";
        }
    }
}
