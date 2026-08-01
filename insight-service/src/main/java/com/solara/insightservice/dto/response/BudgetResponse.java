package com.solara.insightservice.dto.response;

import java.math.BigDecimal;
import java.util.UUID;

public record BudgetResponse(
    UUID userId,
    BigDecimal totalSpent,
    BigDecimal monthlyBudget
) {}
