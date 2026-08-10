package com.solara.insightservice.dto.response;

public record InsightTextResponse(
        String headline,
        String body,
        String suggestion
) {}
