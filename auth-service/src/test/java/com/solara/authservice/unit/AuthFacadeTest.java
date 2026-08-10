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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthFacadeTest {

    @Mock
    AuthService authService;

    @Mock
    JwtService jwtService;

    AuthFacade authFacade;

    UUID userId = UUID.randomUUID();
    String email = "alice@test.com";

    @BeforeEach
    void setUp() {
        authFacade = new AuthFacade(authService, jwtService);
    }

    @Test
    void registerUser_createsUserAndGeneratesTokens() {
        var request = new RegisterRequest(email, "pass123", "Alice", "Smith");
        var userProfile = new UserProfileResponse(userId, email, "Alice", "Smith", "icons", true);
        when(authService.registerUser(request)).thenReturn(userProfile);
        when(jwtService.generateAccessToken(userId, email)).thenReturn("eyJ.access.token");
        when(jwtService.generateRefreshToken(userId, email)).thenReturn("eyJ.refresh.token");

        RegisterResponse result = authFacade.registerUser(request);

        assertThat(result.accessToken()).isEqualTo("eyJ.access.token");
        assertThat(result.refreshToken()).isEqualTo("eyJ.refresh.token");
        assertThat(result.email()).isEqualTo(email);
        verify(authService).registerUser(request);
    }

    @Test
    void loginUser_validCredentials_generatesTokens() {
        var request = new LoginRequest(email, "pass123");
        var userProfile = new UserProfileResponse(userId, email, "Alice", "Smith", "icons", true);
        when(authService.loginUser(request)).thenReturn(userProfile);
        when(jwtService.generateAccessToken(userId, email)).thenReturn("eyJ.access.token");
        when(jwtService.generateRefreshToken(userId, email)).thenReturn("eyJ.refresh.token");

        LoginResponse result = authFacade.loginUser(request);

        assertThat(result.accessToken()).isEqualTo("eyJ.access.token");
        assertThat(result.refreshToken()).isEqualTo("eyJ.refresh.token");
    }

    @Test
    void loginUser_wrongPassword_propagatesError() {
        var request = new LoginRequest("unknown@test.com", "pass");
        when(authService.loginUser(request))
                .thenThrow(new InvalidCredentialsException("Invalid credentials"));

        assertThatThrownBy(() -> authFacade.loginUser(request))
                .isInstanceOf(InvalidCredentialsException.class);
        verifyNoInteractions(jwtService);
        verify(jwtService, never()).generateAccessToken(userId, email);
    }
}