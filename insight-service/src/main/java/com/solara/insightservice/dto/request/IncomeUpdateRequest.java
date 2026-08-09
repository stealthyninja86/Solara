package com.solara.insightservice.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * Typed body for {@code PUT /api/v1/insights/income}. Replaces the untyped
 * {@code Map<String, BigDecimal>}: a missing or negative income is now a 400
 * instead of silently zeroing the user's income.
 */
public record IncomeUpdateRequest(
        @NotNull(message = "income is required")
        @DecimalMin(value = "0.0", message = "income must be >= 0")
        BigDecimal income) {
}
