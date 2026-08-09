package com.solara.insightservice.dto.response;

public record UserSettingsResponse(
        String iconMode,
        Boolean llmEnabled
) {
}