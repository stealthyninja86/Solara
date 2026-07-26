package com.solara.transactionservice.outbox;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class OutboxPublisherService {

    private final KafkaTemplate<String, String> kafkaTemplate;

    public OutboxPublisherService(KafkaTemplate<String, String> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publish(OutboxEntity outbox) {
        kafkaTemplate.send("transaction.events", outbox.getAggregateId().toString(), outbox.getPayload());
    }
}