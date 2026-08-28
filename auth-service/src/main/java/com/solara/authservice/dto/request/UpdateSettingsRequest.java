package com.solara.authservice.dto.request;

import jakarta.validation.constraints.Pattern;

public record UpdateSettingsRequest(
        @Pattern(regexp = "^(emoji|icons)$", message = "iconMode must be 'emoji' or 'icons'")
        String iconMode,
        Boolean aiSettings,
        @Pattern(regexp = "^(OLLAMA|OLLAMA_CLOUD|GEMINI|OPENAI)$", message = "llmProvider must be OLLAMA, OLLAMA_CLOUD, GEMINI, or OPENAI")
        String llmProvider,
        String llmApiKey,
        String llmChatModel
) {
}