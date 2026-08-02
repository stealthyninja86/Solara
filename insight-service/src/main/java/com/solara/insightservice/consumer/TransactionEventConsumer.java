package com.solara.insightservice.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.solara.insightservice.dto.response.AgentResult;
import com.solara.insightservice.dto.request.CategorizationInput;
import com.solara.insightservice.model.CategorizedTransaction;
import com.solara.insightservice.model.ProcessedEvent;
import com.solara.insightservice.dto.event.TransactionEvent;
import com.solara.insightservice.dto.event.TransactionEventPayload;
import com.solara.insightservice.repository.CategorizedTransactionRepository;
import com.solara.insightservice.repository.ProcessedEventRepository;
import com.solara.insightservice.service.CategorizationService;
import com.solara.insightservice.service.ProjectionService;
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
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Component
public class TransactionEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(TransactionEventConsumer.class);

    private final CategorizedTransactionRepository categorizedTransactionRepository;
    private final ProcessedEventRepository processedEventRepository;
    private final ProjectionService projectionService;
    private final CategorizationService categorizationService;
    private final ObjectMapper objectMapper;
    private final boolean skipAi;

    public TransactionEventConsumer(CategorizedTransactionRepository categorizedTransactionRepository,
                                    ProcessedEventRepository processedEventRepository,
                                    ProjectionService projectionService,
                                    CategorizationService categorizationService,
                                    ObjectMapper objectMapper,
                                    @Value("${app.categorization.skip-ai:false}") boolean skipAi) {
        this.categorizedTransactionRepository = categorizedTransactionRepository;
        this.processedEventRepository = processedEventRepository;
        this.projectionService = projectionService;
        this.categorizationService = categorizationService;
        this.objectMapper = objectMapper;
        this.skipAi = skipAi;
    }

    @RetryableTopic(
            attempts = "3",
            dltTopicSuffix = ".dlq",
            exclude = {DataIntegrityViolationException.class}
    )
    @KafkaListener(topics = "transaction.events", containerFactory = "kafkaListenerContainerFactory")
    @Transactional
    public void onEvent(ConsumerRecord<String, String> record, Acknowledgment ack) {
        try {
            TransactionEvent event = objectMapper.readValue(record.value(), TransactionEvent.class);

            try {
                processedEventRepository.save(new ProcessedEvent(event.eventId(), event.eventType()));
            } catch (DataIntegrityViolationException e) {
                ack.acknowledge();
                return;
            }

            switch (event.eventType()) {
                case "transaction.created.v1", "transaction.updated.v1" ->
                        handleCreatedOrUpdated(event);
                case "transaction.deleted.v1" ->
                        handleDeleted(event);
                default ->
                        log.warn("Unknown event type: {}", event.eventType());
            }

            ack.acknowledge();
        } catch (Exception e) {
            log.error("Error processing event: {}", e.getMessage(), e);
            throw new RuntimeException(e);
        }
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

        if (skipAi) {
            transaction.setNeedsReview(true);
            categorizedTransactionRepository.save(transaction);
            log.debug("AI categorization skipped (skip-ai=true), saved uncategorized transaction={}", payload.transactionId());
            return;
        }

        CategorizationInput input = new CategorizationInput(
                payload.merchant(),
                CategorizedTransaction.normalizeMerchant(payload.merchant()),
                payload.description(), payload.amount(), payload.userId(), payload.isBulkImport()
        );

        AgentResult result = categorizationService.categorize(input);

        if (result != null && result.category() != null) {
            applyCategory(transaction, result);
            if (payload.isBulkImport()) {
                if (result.merchant() != null) {
                    transaction.setMerchant(result.merchant());
                }
                if (result.description() != null) {
                    transaction.setOriginalDescription(result.description());
                }
            }
            log.debug("Categorized merchant={} as {} via {}",
                    input.normalizedMerchant(), result.category(), result.method());
        } else {
            log.info("Could not categorize merchant={}, saving uncategorized", input.normalizedMerchant());
            transaction.setNeedsReview(true);
            if (result != null) {
                if (result.merchant() != null) {
                    transaction.setMerchant(result.merchant());
                }
                if (result.confidence() != null) {
                    transaction.setConfidence(result.confidence());
                }
            }
        }

        finishTransaction(transaction);
    }

    private void finishTransaction(CategorizedTransaction transaction) {
        if (transaction.getMerchant() == null && transaction.getOriginalDescription() != null) {
            String narration = transaction.getOriginalDescription();
            transaction.setMerchant(narration.length() > 200 ? narration.substring(0, 200) : narration);
        }
        CategorizedTransaction saved = categorizedTransactionRepository.save(transaction);

        if (saved.getCategory() != null) {
            projectionService.upsertAll(saved.getUserId(), saved.getCategory(),
                    saved.getAmount(), saved.getCreatedAt(), saved.getType());
            categorizationService.publishCategorized(saved, null);
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
        transaction.setNeedsReview(false);
        transaction.setSubscription(false);
    }

    @DltHandler
    public void onDlt(ConsumerRecord<String, String> record) {
        log.error("Event sent to DLQ: topic={}, key={}, value={}",
                record.topic(), record.key(), record.value());
    }
}
