package com.solara.insightservice.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * Typed body for {@code PUT /api/v1/insights/budget}. Replaces the untyped
 * {@code Map<String, BigDecimal>}: a missing or negative budget is now a 400
 * instead of silently zeroing the user's budget.
 */
public record BudgetUpdateRequest(
        @NotNull(message = "budget is required")
        @DecimalMin(value = "0.0", message = "budget must be >= 0")
        BigDecimal budget) {
}
