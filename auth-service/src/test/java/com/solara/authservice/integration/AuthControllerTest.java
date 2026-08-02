package com.solara.authservice.integration;

import com.solara.authservice.config.SecurityConfig;
import com.solara.authservice.controller.AuthController;
import com.solara.authservice.dto.request.LoginRequest;
import com.solara.authservice.dto.request.RegisterRequest;
import com.solara.authservice.dto.response.LoginResponse;
import com.solara.authservice.dto.response.RegisterResponse;
import com.solara.authservice.dto.response.UserProfileResponse;
import com.solara.authservice.exception.InvalidCredentialsException;
import com.solara.authservice.service.AuthFacade;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@Import(SecurityConfig.class)
class AuthControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockitoBean
    AuthFacade authFacade;

    @MockitoBean
    JwtDecoder jwtDecoder;

    String email = "alice@test.com";
    String accessToken = "eyJ.test.access";
    String refreshToken = "eyJ.test.refresh";

    @Test
    void register_validRequest_returns200WithCookie() throws Exception {
        var request = new RegisterRequest(email, "pass123", "Alice", "Smith");
        var registerResponse = new RegisterResponse(accessToken, refreshToken, email);
        when(authFacade.registerUser(any())).thenReturn(registerResponse);

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(header().exists(HttpHeaders.SET_COOKIE))
                .andExpect(jsonPath("$.accessToken").value(accessToken))
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.message").value("User Registered Successfully"))
                .andExpect(jsonPath("$.refreshToken").doesNotExist());
    }

    @Test
    void register_invalidEmail_returns400() throws Exception {
        var request = new RegisterRequest("not-an-email", "pass123", "A", "S");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void login_noSession_validCredentials_returnsTokens() throws Exception {
        var request = new LoginRequest(email, "pass123");
        var loginResponse = new LoginResponse(accessToken, refreshToken, email);
        when(authFacade.tryRefreshSession(any())).thenReturn(Optional.empty());
        when(authFacade.loginUser(any())).thenReturn(loginResponse);

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(header().exists(HttpHeaders.SET_COOKIE))
                .andExpect(jsonPath("$.accessToken").value(accessToken))
                .andExpect(jsonPath("$.message").value("User Login Successfully"));
    }

    @Test
    void login_existingSession_returnsAlreadyLoggedIn() throws Exception {
        var request = new LoginRequest(email, "pass123");
        var loginResponse = new LoginResponse(accessToken, refreshToken, email);
        when(authFacade.tryRefreshSession(any())).thenReturn(Optional.of(loginResponse));

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                        .header("Cookie", "refreshToken=" + refreshToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Already logged in"));
    }

    @Test
    void login_invalidCredentials_returns401() throws Exception {
        var request = new LoginRequest(email, "wrong");
        when(authFacade.tryRefreshSession(any())).thenReturn(Optional.empty());
        when(authFacade.loginUser(any()))
                .thenThrow(new InvalidCredentialsException("Invalid credentials"));

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid credentials"));
    }

    @Test
    void refresh_validCookie_returnsNewTokens() throws Exception {
        var loginResponse = new LoginResponse(accessToken, refreshToken, email);
        when(authFacade.refreshToken(refreshToken)).thenReturn(loginResponse);

        mockMvc.perform(post("/auth/token")
                        .header("Cookie", "refreshToken=" + refreshToken))
                .andExpect(status().isOk())
                .andExpect(header().exists(HttpHeaders.SET_COOKIE))
                .andExpect(jsonPath("$.accessToken").value(accessToken))
                .andExpect(jsonPath("$.message").value("Token Refreshed Successfully"));
    }

    @Test
    void refresh_missingCookie_returns401() throws Exception {
        mockMvc.perform(post("/auth/token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Refresh token cookie is missing"));
    }

    @Test
    @WithMockUser
    void profile_withValidToken_returnsUserProfile() throws Exception {
        var userId = UUID.randomUUID();
        var profile = new UserProfileResponse(userId, email, "Alice", "Smith");
        when(authFacade.getUserById(any())).thenReturn(profile);

        mockMvc.perform(get("/auth/profile")
                        .header("Authorization", "Bearer valid.token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.firstName").value("Alice"))
                .andExpect(jsonPath("$.lastName").value("Smith"));
    }

    @Test
    void profile_noToken_returns401() throws Exception {
        mockMvc.perform(get("/auth/profile"))
                .andExpect(status().isUnauthorized());
    }
}
