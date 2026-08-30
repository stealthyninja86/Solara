package com.solara.authservice.controller;

import com.solara.authservice.dto.request.UpdateSettingsRequest;
import com.solara.authservice.dto.response.LlmModelsResponse;
import com.solara.authservice.dto.response.LlmProvidersResponse;
import com.solara.authservice.dto.response.UserProfileResponse;
import com.solara.authservice.dto.response.UserSettingsResponse;
import com.solara.authservice.entity.LlmProviderConfig;
import com.solara.authservice.entity.User;
import com.solara.authservice.repository.LlmProviderConfigRepository;
import com.solara.authservice.service.AuthFacade;
import com.solara.authservice.service.LlmService;
import com.solara.authservice.service.UserService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/auth")
public class UserSettingsController {

    private static final Logger log = LoggerFactory.getLogger(UserSettingsController.class);

    private final AuthFacade authFacade;
    private final LlmService llmService;
    private final UserService userService;
    private final LlmProviderConfigRepository configRepository;

    public UserSettingsController(AuthFacade authFacade, LlmService llmService, UserService userService,
                                  LlmProviderConfigRepository configRepository) {
        this.authFacade = authFacade;
        this.llmService = llmService;
        this.userService = userService;
        this.configRepository = configRepository;
    }

    @PatchMapping("/profile/settings")
    public ResponseEntity<UserProfileResponse> updateSettings(@Valid @RequestBody UpdateSettingsRequest request) {
        var auth = (JwtAuthenticationToken) SecurityContextHolder.getContext().getAuthentication();
        assert auth != null;
        UUID userId = UUID.fromString(Objects.requireNonNull(auth.getToken().getSubject()));
        UserProfileResponse user = authFacade.updateSettings(userId, request.iconMode(), request.aiSettings(),
                request.llmProvider(), request.llmApiKey(), request.llmChatModel());
        log.info("Settings updated for user: {}", user.email());
        return ResponseEntity.ok(user);
    }

    @GetMapping("/users/{userId}/settings")
    public ResponseEntity<UserSettingsResponse> getUserSettings(@PathVariable UUID userId) {
        return ResponseEntity.ok(authFacade.getUserSettings(userId));
    }

    @GetMapping("/llm/providers")
    public ResponseEntity<LlmProvidersResponse> getProviders() {
        return ResponseEntity.ok(llmService.getProviders());
    }

    @GetMapping("/llm/models")
    public ResponseEntity<LlmModelsResponse> getModels(
            @RequestParam UUID userId,
            @RequestParam String provider,
            @RequestParam(required = false) String apiKey) {
        log.debug("llm models requested: userId={}, provider={}", userId, provider);
        String resolvedApiKey = apiKey;
        if (resolvedApiKey == null || resolvedApiKey.isBlank()) {
            User user = userService.findById(userId)
                    .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
            LlmProviderConfig config = configRepository.findByUserIdAndProvider(userId, provider).orElse(null);
            resolvedApiKey = config != null ? config.getApiKey() : null;
        }
        LlmModelsResponse response = llmService.getModels(provider, resolvedApiKey);
        log.debug("llm models returned: provider={}, count={}", provider, response.models().size());
        return ResponseEntity.ok(response);
    }
}
