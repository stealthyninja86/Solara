package com.solara.authservice.dto.response;

import java.util.List;

public record LlmProvidersResponse(
        List<ProviderInfo> providers,
        String defaultProvider
) {
}
