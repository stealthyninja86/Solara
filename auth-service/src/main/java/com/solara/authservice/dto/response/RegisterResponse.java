package com.solara.authservice.dto.response;

public record RegisterResponse(
        String accessToken,
        String refreshToken,
        String email
) {
}
