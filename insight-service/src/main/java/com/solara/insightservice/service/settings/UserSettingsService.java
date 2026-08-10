package com.solara.insightservice.service.settings;

import com.solara.insightservice.dto.response.UserSettingsResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.UUID;

@Service
public class UserSettingsService {

    private static final Logger log = LoggerFactory.getLogger(UserSettingsService.class);

    private final RestClient restClient;
    private final String apiKey;

    public UserSettingsService(RestClient.Builder builder,
                               @Value("${app.settings.base-url}") String baseUrl,
                               @Value("${app.settings.api-key}") String apiKey) {
        this.restClient = builder
                .baseUrl(baseUrl)
                .defaultStatusHandler(HttpStatusCode::isError, (request, response) -> {
                })
                .build();
        this.apiKey = apiKey;
    }

    public boolean isLlmEnabled(UUID userId) {
        return fetchLlmEnabled(userId);
    }

    private boolean fetchLlmEnabled(UUID userId) {
        try {
            UserSettingsResponse settings = restClient.get()
                    .uri("/auth/users/{userId}/settings", userId)
                    .header("X-Service-Api-Key", apiKey)
                    .retrieve()
                    .body(UserSettingsResponse.class);
            if (settings != null && Boolean.FALSE.equals(settings.llmEnabled())) {
                return false;
            }
            return true;
        } catch (Exception e) {
            log.warn("Failed to fetch settings for user {} (defaulting llmEnabled=true): {}",
                    userId, e.getMessage());
            return true;
        }
    }
}
