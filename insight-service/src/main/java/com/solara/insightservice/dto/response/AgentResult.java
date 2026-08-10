package com.solara.insightservice.dto.response;

import com.solara.insightservice.model.TransactionCategory;

import java.math.BigDecimal;

public record AgentResult(TransactionCategory category, BigDecimal confidence, String method,
                          String merchant, String description, boolean needsReview) {

    public AgentResult(TransactionCategory category, BigDecimal confidence, String method,
                       String merchant, String description) {
        this(category, confidence, method, merchant, description, false);
    }
}
