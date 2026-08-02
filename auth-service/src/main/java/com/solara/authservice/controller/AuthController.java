package com.solara.authservice.controller;

import com.solara.authservice.dto.request.ChangePasswordRequest;
import com.solara.authservice.dto.request.LoginRequest;
import com.solara.authservice.dto.request.RegisterRequest;
import com.solara.authservice.dto.request.UpdateProfileRequest;
import com.solara.authservice.dto.response.AuthResponse;
import com.solara.authservice.dto.response.UserProfileResponse;
import com.solara.authservice.service.AuthFacade;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final AuthFacade authFacade;
    private final long refreshTokenValidity;
    private final boolean cookieSecure;
    private final String cookiePath;

    public AuthController(AuthFacade authFacade,
                          @Value("${jwt.refresh-expiry}") long refreshTokenValidity,
                          @Value("${cookie.secure:true}") boolean cookieSecure,
                          @Value("${cookie.path:/auth}") String cookiePath) {
        this.authFacade = authFacade;
        this.refreshTokenValidity = refreshTokenValidity;
        this.cookieSecure = cookieSecure;
        this.cookiePath = cookiePath;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        var response = authFacade.registerUser(request);
        log.info("Registered user: {}", response.email());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, buildRefreshCookie(response.refreshToken()).toString())
                .body(new AuthResponse(response.accessToken(), response.email(), "User Registered Successfully"));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request,
                                               @CookieValue(value = "refreshToken", required = false) String refreshTokenCookie) {
        var existing = authFacade.tryRefreshSession(refreshTokenCookie);
        if (existing.isPresent()) {
            var response = existing.get();
            log.info("Already logged in: {}", response.email());
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, buildRefreshCookie(response.refreshToken()).toString())
                    .body(new AuthResponse(response.accessToken(), response.email(), "Already logged in"));
        }
        var response = authFacade.loginUser(request);
        log.info("Login successful: {}", response.email());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, buildRefreshCookie(response.refreshToken()).toString())
                .body(new AuthResponse(response.accessToken(), response.email(), "User Login Successfully"));
    }

    @PostMapping("/token")
    public ResponseEntity<AuthResponse> refresh(@CookieValue("refreshToken") String refreshToken) {
        var response = authFacade.refreshToken(refreshToken);
        log.info("Refresh successful");
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, buildRefreshCookie(response.refreshToken()).toString())
                .body(new AuthResponse(response.accessToken(), response.email(), "Token Refreshed Successfully"));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        log.info("User logged out");
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clearRefreshCookie().toString())
                .build();
    }

    private ResponseCookie buildRefreshCookie(String token) {
        return ResponseCookie.from("refreshToken", token)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path(cookiePath)
                .maxAge(refreshTokenValidity / 1000)
                .build();
    }

    private ResponseCookie clearRefreshCookie() {
        return ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path(cookiePath)
                .maxAge(0)
                .build();
    }

    @GetMapping("/profile")
    public ResponseEntity<UserProfileResponse> getUserProfile() {
        var auth = (JwtAuthenticationToken) SecurityContextHolder.getContext().getAuthentication();
        assert auth != null;
        UUID userId = UUID.fromString(Objects.requireNonNull(auth.getToken().getSubject()));
        UserProfileResponse user = authFacade.getUserById(userId);
        return ResponseEntity.ok(user);
    }

    @PatchMapping("/profile")
    public ResponseEntity<UserProfileResponse> updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        var auth = (JwtAuthenticationToken) SecurityContextHolder.getContext().getAuthentication();
        assert auth != null;
        UUID userId = UUID.fromString(Objects.requireNonNull(auth.getToken().getSubject()));
        UserProfileResponse user = authFacade.updateProfile(userId, request.firstName(), request.lastName());
        log.info("Profile updated for user: {}", user.email());
        return ResponseEntity.ok(user);
    }

    @PutMapping("/password")
    public ResponseEntity<Map<String, String>> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        if (!request.newPassword().equals(request.confirmPassword())) {
            return ResponseEntity.badRequest().body(Map.of("error", "New password and confirm password do not match"));
        }
        var auth = (JwtAuthenticationToken) SecurityContextHolder.getContext().getAuthentication();
        assert auth != null;
        UUID userId = UUID.fromString(Objects.requireNonNull(auth.getToken().getSubject()));
        authFacade.changePassword(userId, request.currentPassword(), request.newPassword());
        log.info("Password changed for user id: {}", userId);
        return ResponseEntity.ok(Map.of("message", "Password changed successfully"));
    }
}
