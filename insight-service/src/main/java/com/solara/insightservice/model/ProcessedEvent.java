package com.solara.insightservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "processed_events")
public class ProcessedEvent {

    @Id
    @Column(name = "event_id")
    private UUID eventId;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @Column(name = "consumer_group", nullable = false, length = 50)
    private String consumerGroup;

    @Column(name = "processed_at", nullable = false, updatable = false)
    private Instant processedAt;

    public ProcessedEvent() {}

    public ProcessedEvent(UUID eventId, String eventType) {
        this(eventId, eventType, "insight-service");
    }

    public ProcessedEvent(UUID eventId, String eventType, String consumerGroup) {
        this.eventId = eventId;
        this.eventType = eventType;
        this.consumerGroup = consumerGroup;
    }

    public UUID getEventId() { return eventId; }
    public void setEventId(UUID eventId) { this.eventId = eventId; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public String getConsumerGroup() { return consumerGroup; }
    public void setConsumerGroup(String consumerGroup) { this.consumerGroup = consumerGroup; }

    public Instant getProcessedAt() { return processedAt; }
    public void setProcessedAt(Instant processedAt) { this.processedAt = processedAt; }

    @PrePersist
    void prePersist() {
        if (this.processedAt == null) this.processedAt = Instant.now();
    }
}
