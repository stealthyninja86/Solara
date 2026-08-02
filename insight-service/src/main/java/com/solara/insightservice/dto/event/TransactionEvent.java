package com.solara.insightservice.dto.event;

import java.time.Instant;
import java.util.UUID;

public record TransactionEvent(
    UUID eventId,
    String eventVersion,
    String eventType,
    Instant occurredAt,
    TransactionEventPayload payload
) {}
