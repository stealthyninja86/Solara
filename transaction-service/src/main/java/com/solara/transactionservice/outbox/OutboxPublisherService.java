package com.solara.transactionservice.outbox;

import org.apache.kafka.clients.producer.RecordMetadata;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
public class OutboxPublisherService {

    private static final Logger log = LoggerFactory.getLogger(OutboxPublisherService.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final long sendTimeoutMillis;

    public OutboxPublisherService(KafkaTemplate<String, String> kafkaTemplate,
                                  @Value("${app.outbox.send-timeout-ms:5000}") long sendTimeoutMillis) {
        this.kafkaTemplate = kafkaTemplate;
        this.sendTimeoutMillis = sendTimeoutMillis;
    }

    public void publish(OutboxEntity outbox) {
        long start = System.currentTimeMillis();
        log.info("Outbox publish start: aggregateId={}, eventType={}",
                outbox.getAggregateId(), outbox.getEventType());
        try {
            RecordMetadata metadata = kafkaTemplate
                    .send("transaction.events", outbox.getAggregateId().toString(), outbox.getPayload())
                    .get(sendTimeoutMillis, TimeUnit.MILLISECONDS)
                    .getRecordMetadata();
            log.info("Outbox publish acknowledged: topic={}, partition={}, offset={}, aggregateId={}, durationMs={}",
                    metadata.topic(), metadata.partition(), metadata.offset(), outbox.getAggregateId(),
                    System.currentTimeMillis() - start);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("Outbox publish interrupted: aggregateId={}, error={}",
                    outbox.getAggregateId(), e.getMessage());
            throw new IllegalStateException("Interrupted while waiting for Kafka acknowledgement", e);
        } catch (Exception e) {
            log.error("Outbox publish failed: aggregateId={}, eventType={}, error={}",
                    outbox.getAggregateId(), outbox.getEventType(), e.getMessage());
            throw new IllegalStateException(
                    "Kafka send not acknowledged within " + sendTimeoutMillis + "ms: " + e.getMessage(), e);
        }
    }
}
