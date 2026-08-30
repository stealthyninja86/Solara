package com.solara.authservice.dto.response;

import java.util.UUID;

public record UserProfileResponse(
        UUID id,
        String email,
        String firstName,
        String lastName,
        String iconMode,
        boolean aiSettings,
        String llmProvider,
        String llmApiKey,
        String llmChatModel,
        String llmDescription
) {
}