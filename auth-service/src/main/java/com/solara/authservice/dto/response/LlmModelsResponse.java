package com.solara.authservice.dto.response;

import java.util.List;

public record LlmModelsResponse(
        String provider,
        List<ModelInfo> models
) {
}
