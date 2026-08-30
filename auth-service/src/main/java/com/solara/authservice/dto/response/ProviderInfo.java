package com.solara.authservice.dto.response;

import java.util.List;

public record ProviderInfo(
        String value,
        String label,
        String description,
        List<String> tutorial,
        boolean requiresApiKey,
        String keyPlaceholder,
        String dashboardUrl
) {
}
