package com.solara.insightservice.dto.response;

import com.solara.insightservice.model.TransactionCategory;

import java.math.BigDecimal;

public record ReportCategorySpending(TransactionCategory category, BigDecimal amount,
                                     BigDecimal previousAmount, int changePercent) {}
