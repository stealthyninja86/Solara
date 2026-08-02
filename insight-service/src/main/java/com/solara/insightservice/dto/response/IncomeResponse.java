package com.solara.insightservice.dto.response;

import java.math.BigDecimal;
import java.util.UUID;

public record IncomeResponse(
    UUID userId,
    BigDecimal monthlyIncome
) {}
