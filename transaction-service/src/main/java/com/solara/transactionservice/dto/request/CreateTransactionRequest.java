package com.solara.transactionservice.dto.request;

import com.solara.transactionservice.model.PaymentMode;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record CreateTransactionRequest(
        @NotNull UUID userId,
        @NotNull BigDecimal amount,
        @Size(max = 500) String description,
        @NotNull @Size(max = 200) String merchant,
        @NotNull PaymentMode paymentMode
) {}