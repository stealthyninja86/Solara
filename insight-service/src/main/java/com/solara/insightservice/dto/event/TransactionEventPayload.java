package com.solara.insightservice.dto.event;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TransactionEventPayload(
    UUID transactionId,
    UUID userId,
    String merchant,
    String description,
    BigDecimal amount,
    String currency,
    String paymentMode,
    String type,
    Instant timestamp,
    boolean isBulkImport
) {}
