package com.solara.insightservice.dto.response;

import java.math.BigDecimal;

public record ReportSummary(BigDecimal income, BigDecimal expenses,
                            BigDecimal savings, int savingsRate) {}
