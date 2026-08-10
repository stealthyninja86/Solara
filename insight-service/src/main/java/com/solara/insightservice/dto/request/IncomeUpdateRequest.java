package com.solara.insightservice.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record IncomeUpdateRequest(
        @NotNull(message = "income is required")
        @DecimalMin(value = "0.0", message = "income must be >= 0")
        BigDecimal income) {
}
