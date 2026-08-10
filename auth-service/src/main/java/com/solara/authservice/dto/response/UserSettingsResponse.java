package com.solara.authservice.dto.response;

public record UserSettingsResponse(
        String iconMode,
        Boolean llmEnabled
) {
}