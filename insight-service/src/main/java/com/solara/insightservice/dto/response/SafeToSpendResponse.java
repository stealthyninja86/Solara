package com.solara.insightservice.dto.response;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

public record SafeToSpendResponse(
    UUID userId,
    BigDecimal safeToSpend,
    BigDecimal recurringCosts,
    Map<String, BigDecimal> recurringCostsByKind,
    String period
) {}
