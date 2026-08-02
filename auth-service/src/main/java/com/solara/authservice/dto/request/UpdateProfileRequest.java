package com.solara.authservice.dto.request;

public record UpdateProfileRequest(
        String firstName,
        String lastName
) {
}
