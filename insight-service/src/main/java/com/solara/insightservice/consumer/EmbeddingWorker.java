package com.solara.insightservice.consumer;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.solara.insightservice.dto.event.TransactionCategorizedEvent;
import com.solara.insightservice.dto.event.TransactionCategorizedEventPayload;
import com.solara.insightservice.model.ProcessedEvent;
import com.solara.insightservice.model.TransactionCategory;
import com.solara.insightservice.repository.MerchantProfileRepository;
import com.solara.insightservice.repository.ProcessedEventRepository;
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
import org.springframework.transaction.annotation.Transactional;

@Component
public class EmbeddingWorker {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingWorker.class);

    private final ObjectMapper objectMapper;
    private final ProcessedEventRepository processedEventRepository;
    private final MerchantProfileRepository merchantProfileRepository;
    private final EmbeddingModel embeddingModel;

    public EmbeddingWorker(ObjectMapper objectMapper,
                           ProcessedEventRepository processedEventRepository,
                           MerchantProfileRepository merchantProfileRepository,
                           EmbeddingModel embeddingModel) {
        this.objectMapper = objectMapper;
        this.processedEventRepository = processedEventRepository;
        this.merchantProfileRepository = merchantProfileRepository;
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
    @Transactional
    public void onEvent(ConsumerRecord<String, String> record, Acknowledgment ack) {
        try {
            TransactionCategorizedEvent event =
                    objectMapper.readValue(record.value(), TransactionCategorizedEvent.class);

            try {
                processedEventRepository.save(new ProcessedEvent(
                        event.eventId(), event.eventType(), "insight-embedding-worker"));
            } catch (DataIntegrityViolationException e) {
                ack.acknowledge();
                return;
            }

            TransactionCategorizedEventPayload payload = event.payload();
            if (payload.previousMerchant() != null && !payload.previousMerchant().isBlank()) {
                merchantProfileRepository.deleteByUserIdAndNormalizedMerchant(
                        payload.userId(), payload.previousMerchant());
            }
            upsertProfile(payload);

            ack.acknowledge();
        } catch (Exception e) {
            log.error("Embedding worker failed: {}", e.getMessage(), e);
            throw new RuntimeException(e);
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
        float[] embedding = embeddingModel.embed(embedText);

        merchantProfileRepository.upsert(
                payload.userId(), payload.merchant(), normalizedMerchant,
                payload.description(), category.name(), toVectorLiteral(embedding)
        );
    }

    private String toVectorLiteral(float[] values) {
        StringBuilder builder = new StringBuilder("[");
        for (int i = 0; i < values.length; i++) {
            if (i > 0) builder.append(",");
            builder.append(values[i]);
        }
        return builder.append("]").toString();
    }

    @DltHandler
    public void onDlt(ConsumerRecord<String, String> record) {
        log.error("Categorized event sent to DLQ: topic={}, key={}, value={}",
                record.topic(), record.key(), record.value());
    }
}