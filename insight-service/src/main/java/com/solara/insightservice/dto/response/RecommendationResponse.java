package com.solara.insightservice.dto.response;

public record RecommendationResponse(
        InsightCardResponse card,
        String action              // "set_budget" | "cut_spending" | "review_budget" | "categorize_transactions"
) {}