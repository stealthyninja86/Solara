package com.solara.insightservice.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;

public record SubscriptionRequest(
        @NotBlank(message = "merchant is required") String merchant,
        @Pattern(regexp = "(?i)^(DAILY|WEEKLY|MONTHLY|YEARLY)$",
                message = "frequency must be one of DAILY, WEEKLY, MONTHLY, YEARLY") String frequency,
        @NotNull(message = "amount is required")
        @DecimalMin(value = "0.01", message = "amount must be positive") BigDecimal amount,
        String kind,
        Integer amountTolerancePercent,
        Integer tenureMonths,
        Integer paidMonths,
        String payeeMerchant) {}
