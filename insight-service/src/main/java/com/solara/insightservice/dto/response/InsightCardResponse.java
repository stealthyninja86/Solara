package com.solara.insightservice.dto.response;

import com.solara.insightservice.model.InsightType;

public record InsightCardResponse(
        String factId,
        InsightType type,
        String label,
        InsightTextResponse text,           // validated LLM card text, or null = card dropped
        String value,
        String changePercent,            // may be null
        String action,                   // filled by RecommendationService, or null
        Long retryAfterSeconds           // failed cards only: seconds until the cache entry expires
) {}