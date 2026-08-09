package com.solara.insightservice.service;

import com.solara.insightservice.dto.response.InsightCardResponse;
import com.solara.insightservice.model.ReportPeriod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * The Overview surface — one of exactly two surface services (with
 * {@code RecommendationService}). It resolves the {@code llmEnabled} toggle
 * once per request and delegates to the shared insight engine's
 * {@code InsightGenerator.feed} — the same cached cards Recommendations
 * consumes, so the two surfaces can never disagree.
 */
@Service
public class OverviewService {

    private static final Logger log = LoggerFactory.getLogger(OverviewService.class);

    private final InsightGenerator insightGenerator;
    private final UserSettingsService userSettingsService;

    public OverviewService(InsightGenerator insightGenerator,
                           UserSettingsService userSettingsService) {
        this.insightGenerator = insightGenerator;
        this.userSettingsService = userSettingsService;
    }

    public List<InsightCardResponse> overview(UUID userId, ReportPeriod period, LocalDate at) {
        log.debug("overview requested: userId={}, period={}, at={}", userId, period, at);
        LocalDate anchor = at != null ? at : LocalDate.now();
        boolean llmEnabled = userSettingsService.isLlmEnabled(userId);
        List<InsightCardResponse> cards = insightGenerator.feed(userId, period, anchor, llmEnabled);
        log.debug("overview returned: userId={}, count={}", userId, cards.size());
        return cards;
    }
}
