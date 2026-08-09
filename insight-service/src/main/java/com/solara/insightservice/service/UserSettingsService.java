package com.solara.insightservice.service;

import com.solara.insightservice.dto.response.UserSettingsResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.UUID;

/**
 * Reads a user's account settings from auth-service over synchronous REST
 * (service-to-service, authenticated with the shared service API key).
 *
 * <p>Deliberately uncached: the value gated here is the user's privacy/cost
 * toggle ("send my transactions to the LLM"). A cached snapshot would keep
 * LLM calls firing up to one TTL after the user disabled the flag, and an
 * event-driven invalidation (Kafka) is disproportionate for a setting that
 * changes once. The cost of uncached reads is one cheap auth-service query
 * per card generation / categorization batch — acceptable at this scale, and
 * the threshold where it stops being acceptable is exactly where the
 * {@code user.settings.updated.v1} event should be introduced.</p>
 *
 * <p>Failures default to {@code llmEnabled=true} — an auth-service outage must
 * never silently disable LLM categorization.</p>
 */
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
