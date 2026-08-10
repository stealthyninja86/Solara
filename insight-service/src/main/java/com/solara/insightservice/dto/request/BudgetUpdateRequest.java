package com.solara.insightservice.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record BudgetUpdateRequest(
        @NotNull(message = "budget is required")
        @DecimalMin(value = "0.0", message = "budget must be >= 0")
        BigDecimal budget) {
}
