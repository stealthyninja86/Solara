package com.solara.insightservice.dto.response;

import java.math.BigDecimal;
import java.util.UUID;

public record SafeToSpendResponse(
    UUID userId,
    BigDecimal safeToSpend,
    String period
) {}
