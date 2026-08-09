package com.solara.insightservice.dto.response;

/**
 * A recommendation = one card from the shared feed + the action button offered
 * on it. The card text inside the card is not duplicated here.
 */
public record RecommendationResponse(
        InsightCardResponse card,
        String action              // "review" | "set_budget" | "cancel_subscription" | "cut_spending"
) {}