package com.solara.transactionservice.dto.response;

import com.solara.transactionservice.model.PaymentMode;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TransactionResponse(
        UUID id, UUID userId, BigDecimal amount,
        String description, String merchant, PaymentMode paymentMode,
        String currency, Instant timestamp,
        Instant createdAt, Instant updatedAt) {
}