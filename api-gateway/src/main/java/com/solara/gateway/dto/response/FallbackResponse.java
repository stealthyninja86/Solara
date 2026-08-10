package com.solara.gateway.dto.response;

import java.time.Instant;

public record FallbackResponse(
        String error,
        String message,
        String retryAfter,
        Instant timestamp) {}