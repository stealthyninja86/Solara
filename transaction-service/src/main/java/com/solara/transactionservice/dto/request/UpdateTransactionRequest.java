package com.solara.transactionservice.dto.request;

import com.solara.transactionservice.model.PaymentMode;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record UpdateTransactionRequest(
        BigDecimal amount,
        @Size(max = 500) String description,
        @Size(max = 200) String merchant,
        PaymentMode paymentMode
) {}