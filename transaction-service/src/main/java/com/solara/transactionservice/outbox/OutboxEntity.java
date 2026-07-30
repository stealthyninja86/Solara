package com.solara.transactionservice.outbox;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.solara.transactionservice.model.ImportJob;
import com.solara.transactionservice.model.Transaction;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "outbox")
public class OutboxEntity {

    @Id
    private UUID id;

    @Column(name = "aggregate_id", nullable = false)
    private UUID aggregateId;

    @Column(name = "event_type", nullable = false, length = 100)
    private String eventType;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String payload;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    public OutboxEntity() {}

    public OutboxEntity(UUID aggregateId, String eventType, String payload) {
        this.id = UUID.randomUUID();
        this.aggregateId = aggregateId;
        this.eventType = eventType;
        this.payload = payload;
        this.createdAt = Instant.now();
    }

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static OutboxEntity forTransaction(Transaction transaction) {
        return forTransaction(transaction, "transaction.created.v1");
    }

    public static OutboxEntity forTransaction(Transaction transaction, String eventType) {
        try {
            ObjectNode payload = MAPPER.createObjectNode()
                    .put("transactionId", transaction.getId().toString())
                    .put("userId", transaction.getUserId().toString())
                    .put("description", transaction.getDescription() != null ? transaction.getDescription() : "")
                    .put("amount", transaction.getAmount())
                    .put("currency", transaction.getCurrency())
                    .put("merchant", transaction.getMerchant())
                    .put("paymentMode", transaction.getPaymentMode().name())
                    .put("type", transaction.getType().name())
                    .put("timestamp", transaction.getTimestamp().toString())
                    .put("isBulkImport", transaction.isBulkImport());

            ObjectNode envelope = MAPPER.createObjectNode()
                    .put("eventId", UUID.randomUUID().toString())
                    .put("eventVersion", "1")
                    .put("eventType", eventType)
                    .put("occurredAt", Instant.now().toString())
                    .set("payload", payload);

            return new OutboxEntity(transaction.getId(), eventType, MAPPER.writeValueAsString(envelope));
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize transaction event", e);
        }
    }

    public static OutboxEntity forDeletedTransaction(Transaction transaction) {
        try {
            ObjectNode payload = MAPPER.createObjectNode()
                    .put("transactionId", transaction.getId().toString())
                    .put("userId", transaction.getUserId().toString());

            ObjectNode envelope = MAPPER.createObjectNode()
                    .put("eventId", UUID.randomUUID().toString())
                    .put("eventVersion", "1")
                    .put("eventType", "transaction.deleted.v1")
                    .put("occurredAt", Instant.now().toString())
                    .set("payload", payload);

            return new OutboxEntity(transaction.getId(), "transaction.deleted.v1", MAPPER.writeValueAsString(envelope));
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize delete event", e);
        }
    }

    public static OutboxEntity forBulkImportCompletion(ImportJob job, int importedCount, int errorCount) {
        try {
            ObjectNode payload = MAPPER.createObjectNode()
                    .put("userId", job.getUserId().toString())
                    .put("count", importedCount)
                    .put("failedCount", errorCount);

            ObjectNode envelope = MAPPER.createObjectNode()
                    .put("eventId", UUID.randomUUID().toString())
                    .put("eventVersion", "1")
                    .put("eventType", "bulk.import.completed.v1")
                    .put("occurredAt", Instant.now().toString())
                    .set("payload", payload);

            return new OutboxEntity(job.getId(), "bulk.import.completed.v1", MAPPER.writeValueAsString(envelope));
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize bulk import completion event", e);
        }
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getAggregateId() {
        return aggregateId;
    }

    public void setAggregateId(UUID aggregateId) {
        this.aggregateId = aggregateId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getPayload() {
        return payload;
    }

    public void setPayload(String payload) {
        this.payload = payload;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(Instant publishedAt) {
        this.publishedAt = publishedAt;
    }
}