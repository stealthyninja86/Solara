package com.solara.transactionservice.outbox;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class OutboxPublisherService {

    private static final Logger log = LoggerFactory.getLogger(OutboxPublisherService.class);

    private final KafkaTemplate<String, String> kafkaTemplate;

    public OutboxPublisherService(KafkaTemplate<String, String> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publish(OutboxEntity outbox) {
        log.debug("Publishing outbox entry to Kafka: topic={}, key={}, eventType={}",
                "transaction.events", outbox.getAggregateId(), outbox.getEventType());
        kafkaTemplate.send("transaction.events", outbox.getAggregateId().toString(), outbox.getPayload())
                .whenComplete((result, error) -> {
                    if (error != null) {
                        log.error("Kafka send failed: topic={}, key={}, eventType={}",
                                "transaction.events", outbox.getAggregateId(), outbox.getEventType(), error);
                    } else {
                        log.debug("Kafka send acknowledged: topic={}, partition={}, offset={}, key={}",
                                result.getRecordMetadata().topic(),
                                result.getRecordMetadata().partition(),
                                result.getRecordMetadata().offset(),
                                outbox.getAggregateId());
                    }
                });
    }
}