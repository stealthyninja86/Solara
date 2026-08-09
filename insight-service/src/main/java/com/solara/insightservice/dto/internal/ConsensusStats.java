package com.solara.insightservice.dto.internal;

import java.math.BigDecimal;

public record ConsensusStats(
    String category,
    BigDecimal confidence,
    long transactionCount
) {}
