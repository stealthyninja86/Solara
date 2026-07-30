package com.solara.transactionservice.dto.request;

import com.solara.transactionservice.model.PaymentMode;
import com.solara.transactionservice.model.TransactionType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record CreateTransactionRequest(
        @NotNull UUID userId,
        @NotNull @Size(max = 200) String merchant,
        @NotNull BigDecimal amount,
        @NotNull PaymentMode paymentMode,
        @NotNull TransactionType type,
        @Size(max = 500) String description
) {}