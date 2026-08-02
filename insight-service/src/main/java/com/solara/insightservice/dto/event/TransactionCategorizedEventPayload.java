package com.solara.insightservice.dto.event;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TransactionCategorizedEventPayload(
        UUID transactionId,
        UUID userId,
        String merchant,
        String normalizedMerchant,
        String description,
        String category,
        BigDecimal confidence,
        String method,
        String previousMerchant
) {}