package com.solara.insightservice.dto.response;

import com.solara.insightservice.model.TransactionCategory;

import java.math.BigDecimal;

public record AgentResult(TransactionCategory category, BigDecimal confidence, String method,
                          String merchant, String description) {}
