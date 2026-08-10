package com.solara.authservice.dto.request;

import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @Size(max = 50, message = "firstName must be at most 50 characters")
        String firstName,
        @Size(max = 50, message = "lastName must be at most 50 characters")
        String lastName
) {
}
