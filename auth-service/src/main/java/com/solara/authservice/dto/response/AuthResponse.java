package com.solara.authservice.dto.response;

public record AuthResponse(
        String accessToken,
        String email,
        String message
) {
}
