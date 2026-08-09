package com.solara.insightservice.dto.response;

import com.solara.insightservice.model.InsightQuestion;

/**
 * A fully rendered feed card — no formatting, no LLM, nothing left to the
 * frontend. Both the Overview (all questions) and Recommendations (ACTION +
 * NEXT filter) surfaces consume the same card shape from the same cached feed.
 *
 * @param action the action the frontend button offers, filled by
 *               {@code RecommendationService} for ACTION/NEXT cards
 *               ("review" | "set_budget" | "cancel_subscription" | "cut_spending"),
 *               or null for STATUS cards
 */
public record InsightCardResponse(
        String factId,
        InsightQuestion question,
        String label,
        InsightTextResponse text,           // validated LLM card text, or null = card dropped
        String value,
        String changePercent,            // may be null
        String action                    // filled by RecommendationService, or null
) {}