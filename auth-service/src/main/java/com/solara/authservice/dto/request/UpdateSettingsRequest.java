package com.solara.authservice.dto.request;

import jakarta.validation.constraints.Pattern;

public record UpdateSettingsRequest(
        @Pattern(regexp = "^(emoji|icons)$", message = "iconMode must be 'emoji' or 'icons'")
        String iconMode,
        Boolean llmEnabled
) {
}