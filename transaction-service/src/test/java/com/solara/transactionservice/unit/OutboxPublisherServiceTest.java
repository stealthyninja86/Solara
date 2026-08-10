package com.solara.transactionservice.unit;

import com.solara.transactionservice.outbox.OutboxEntity;
import com.solara.transactionservice.outbox.OutboxPublisherService;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.TopicPartition;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OutboxPublisherServiceTest {

    @Mock
    KafkaTemplate<String, String> kafkaTemplate;

    private OutboxPublisherService publisher;

    @BeforeEach
    void setUp() {
        this.publisher = new OutboxPublisherService(kafkaTemplate, 5000L);
    }

    @Test
    void publishSendsPayloadToTransactionEventsWithAggregateKey() {
        UUID aggregateId = UUID.randomUUID();
        OutboxEntity outbox = new OutboxEntity(aggregateId, "transaction.created.v1",
                "{\"id\":\"" + aggregateId + "\"}");
        RecordMetadata metadata = new RecordMetadata(
                new TopicPartition("transaction.events", 0), 0L, 5, 0L, 5, 10);
        when(kafkaTemplate.send(eq("transaction.events"), eq(aggregateId.toString()), eq(outbox.getPayload())))
                .thenReturn(CompletableFuture.completedFuture(
                        new SendResult<>(null, metadata)));

        publisher.publish(outbox);

        verify(kafkaTemplate).send("transaction.events", aggregateId.toString(), outbox.getPayload());
        assertThat(metadata.offset()).isEqualTo(5L);
    }
}