package com.solara.insightservice.dto.response;

public record DashboardSectionError(
    String code,
    String message,
    boolean retryable
) {}
