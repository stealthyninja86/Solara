package com.solara.authservice.service;

import com.solara.authservice.dto.request.LoginRequest;
import com.solara.authservice.dto.request.RegisterRequest;
import com.solara.authservice.dto.response.LoginResponse;
import com.solara.authservice.dto.response.RegisterResponse;
import com.solara.authservice.dto.response.UserProfileResponse;
import com.solara.authservice.exception.InvalidCredentialsException;
import com.solara.authservice.exception.UserNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
public class AuthFacade {

    Logger logger = LoggerFactory.getLogger(AuthFacade.class);

    private final AuthService authService;
    private final JwtService jwtService;

    public AuthFacade(AuthService authService, JwtService jwtService) {
        this.authService = authService;
        this.jwtService = jwtService;
    }

    public RegisterResponse registerUser(RegisterRequest request) {
        UserProfileResponse user = authService.registerUser(request);
        String accessToken = jwtService.generateAccessToken(user.id(), user.email());
        String refreshToken = jwtService.generateRefreshToken(user.id(), user.email());
        logger.info("User registered: {}", user.email());
        return new RegisterResponse(accessToken, refreshToken, user.email());
    }

    public LoginResponse loginUser(LoginRequest request) {
        UserProfileResponse user = authService.loginUser(request);
        String accessToken = jwtService.generateAccessToken(user.id(), user.email());
        String refreshToken = jwtService.generateRefreshToken(user.id(), user.email());
        logger.info("User logged in: {}", user.email());
        return new LoginResponse(accessToken, refreshToken, user.email());
    }

    public LoginResponse refreshToken(String token) {
        if (!jwtService.isTokenValid(token)) {
            throw new InvalidCredentialsException("Invalid refresh token");
        }
        var userId = jwtService.extractUserId(token);
        var email = jwtService.extractEmail(token);
        String newAccessToken = jwtService.generateAccessToken(userId, email);
        String newRefreshToken = jwtService.generateRefreshToken(userId, email);
        logger.info("Token refreshed: {}", email);
        return new LoginResponse(newAccessToken, newRefreshToken, email);
    }

    public Optional<LoginResponse> tryRefreshSession(String refreshTokenCookie) {
        if (refreshTokenCookie == null || !jwtService.isTokenValid(refreshTokenCookie)) {
            return Optional.empty();
        }
        var userId = jwtService.extractUserId(refreshTokenCookie);
        var email = jwtService.extractEmail(refreshTokenCookie);
        String accessToken = jwtService.generateAccessToken(userId, email);
        String newRefreshToken = jwtService.generateRefreshToken(userId, email);
        return Optional.of(new LoginResponse(accessToken, newRefreshToken, email));
    }

    public UserProfileResponse getUserByEmail(String email) {
        return authService.getUserByEmail(email);
    }

    public UserProfileResponse getUserById(UUID id) {
        return authService.getUserById(id);
    }
}
