package com.solara.authservice.dto.response;

public record LoginResponse(
        String accessToken,
        String refreshToken,
        String email
) {
}
