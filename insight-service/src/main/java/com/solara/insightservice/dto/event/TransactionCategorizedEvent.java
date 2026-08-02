package com.solara.insightservice.dto.event;

import java.time.Instant;
import java.util.UUID;

public record TransactionCategorizedEvent(
        UUID eventId,
        String eventVersion,
        String eventType,
        Instant occurredAt,
        TransactionCategorizedEventPayload payload
) {
    public static TransactionCategorizedEvent of(TransactionCategorizedEventPayload payload) {
        return new TransactionCategorizedEvent(
                UUID.randomUUID(), "1", "transaction.categorized.v1", Instant.now(), payload
        );
    }
}