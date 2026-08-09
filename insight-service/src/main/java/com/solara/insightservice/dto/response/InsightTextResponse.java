package com.solara.insightservice.dto.response;

/**
 * One response shape for the insight card text: what the LLM must produce as
 * strict JSON and what the feed serves to the frontend. The validator
 * guarantees every field is present, token-resolved, and within length caps
 * before a card is allowed into the feed.
 */
public record InsightTextResponse(
        String headline,
        String body,
        String suggestion
) {}
