package com.solara.authservice.unit;

import com.solara.authservice.dto.request.LoginRequest;
import com.solara.authservice.dto.request.RegisterRequest;
import com.solara.authservice.dto.response.LoginResponse;
import com.solara.authservice.dto.response.RegisterResponse;
import com.solara.authservice.dto.response.UserProfileResponse;
import com.solara.authservice.exception.InvalidCredentialsException;
import com.solara.authservice.service.AuthFacade;
import com.solara.authservice.service.AuthService;
import com.solara.authservice.service.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthFacadeTest {

    @Mock
    AuthService authService;

    @Mock
    JwtService jwtService;

    AuthFacade authFacade;

    UUID userId = UUID.randomUUID();
    String email = "alice@test.com";
    String accessToken = "eyJ.access.token";
    String refreshToken = "eyJ.refresh.token";

    @BeforeEach
    void setUp() {
        authFacade = new AuthFacade(authService, jwtService);
    }

    @Test
    void registerUser_createsUserAndGeneratesTokens() {
        var request = new RegisterRequest(email, "pass123", "Alice", "Smith");
        var userProfile = new UserProfileResponse(userId, email, "Alice", "Smith");
        when(authService.registerUser(request)).thenReturn(userProfile);
        when(jwtService.generateAccessToken(userId, email)).thenReturn(accessToken);
        when(jwtService.generateRefreshToken(userId, email)).thenReturn(refreshToken);

        RegisterResponse result = authFacade.registerUser(request);

        assertThat(result.accessToken()).isEqualTo(accessToken);
        assertThat(result.refreshToken()).isEqualTo(refreshToken);
        assertThat(result.email()).isEqualTo(email);
        verify(authService).registerUser(request);
        verify(jwtService).generateAccessToken(userId, email);
        verify(jwtService).generateRefreshToken(userId, email);
    }

    @Test
    void loginUser_validCredentials_generatesTokens() {
        var request = new LoginRequest(email, "pass123");
        var userProfile = new UserProfileResponse(userId, email, "Alice", "Smith");
        when(authService.loginUser(request)).thenReturn(userProfile);
        when(jwtService.generateAccessToken(userId, email)).thenReturn(accessToken);
        when(jwtService.generateRefreshToken(userId, email)).thenReturn(refreshToken);

        LoginResponse result = authFacade.loginUser(request);

        assertThat(result.accessToken()).isEqualTo(accessToken);
        assertThat(result.refreshToken()).isEqualTo(refreshToken);
    }

    @Test
    void loginUser_throwsFromAuthService_propagates() {
        var request = new LoginRequest("unknown@test.com", "pass");
        when(authService.loginUser(request))
                .thenThrow(new InvalidCredentialsException("Invalid credentials"));

        assertThatThrownBy(() -> authFacade.loginUser(request))
                .isInstanceOf(InvalidCredentialsException.class);
        verifyNoInteractions(jwtService);
    }

    @Test
    void refreshToken_validToken_generatesNewTokens() {
        String oldToken = "eyJ.old.refresh";
        when(jwtService.isTokenValid(oldToken)).thenReturn(true);
        when(jwtService.extractUserId(oldToken)).thenReturn(userId);
        when(jwtService.extractEmail(oldToken)).thenReturn(email);
        when(jwtService.generateAccessToken(userId, email)).thenReturn("newAT");
        when(jwtService.generateRefreshToken(userId, email)).thenReturn("newRT");

        LoginResponse result = authFacade.refreshToken(oldToken);

        assertThat(result.accessToken()).isEqualTo("newAT");
        assertThat(result.refreshToken()).isEqualTo("newRT");
        assertThat(result.email()).isEqualTo(email);
    }

    @Test
    void refreshToken_invalidToken_throws() {
        String oldToken = "eyJ.invalid";
        when(jwtService.isTokenValid(oldToken)).thenReturn(false);

        assertThatThrownBy(() -> authFacade.refreshToken(oldToken))
                .isInstanceOf(InvalidCredentialsException.class);
        verify(jwtService, never()).generateAccessToken(any(), any());
    }

    @Test
    void tryRefreshSession_validCookie_returnsLoginResponse() {
        String cookieToken = "eyJ.cookie.token";
        when(jwtService.isTokenValid(cookieToken)).thenReturn(true);
        when(jwtService.extractUserId(cookieToken)).thenReturn(userId);
        when(jwtService.extractEmail(cookieToken)).thenReturn(email);
        when(jwtService.generateAccessToken(userId, email)).thenReturn("newAT");
        when(jwtService.generateRefreshToken(userId, email)).thenReturn("newRT");

        Optional<LoginResponse> result = authFacade.tryRefreshSession(cookieToken);

        assertThat(result).isPresent();
        assertThat(result.get().accessToken()).isEqualTo("newAT");
    }

    @Test
    void tryRefreshSession_nullCookie_returnsEmpty() {
        Optional<LoginResponse> result = authFacade.tryRefreshSession(null);
        assertThat(result).isEmpty();
        verifyNoInteractions(jwtService);
    }

    @Test
    void tryRefreshSession_invalidCookie_returnsEmpty() {
        when(jwtService.isTokenValid("invalid")).thenReturn(false);

        Optional<LoginResponse> result = authFacade.tryRefreshSession("invalid");
        assertThat(result).isEmpty();
    }
}
