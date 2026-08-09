package com.solara.insightservice.service;

import com.solara.insightservice.dto.response.InsightCardResponse;
import com.solara.insightservice.dto.response.RecommendationResponse;
import com.solara.insightservice.metrics.InsightPipeMetrics;
import com.solara.insightservice.model.InsightQuestion;
import com.solara.insightservice.model.ReportPeriod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * The Recommendations surface — one of exactly two surface services (with
 * {@code OverviewService}). It resolves the {@code llmEnabled} toggle once
 * per request, then filters the shared feed's ACTION + NEXT cards and adds
 * the action button. Same facts, same ranking, same card text, same validator
 * — the only difference is presentation.
 *
 * <p>Budget-aware: the action button never asks the user to enter data they
 * already provided — "set budget" only appears when no budget exists for the
 * anchor month (checked once per request via {@code InsightQueryService}).</p>
 */
@Service
public class RecommendationService {

    private static final Logger log = LoggerFactory.getLogger(RecommendationService.class);

    private final InsightGenerator insightGenerator;
    private final InsightQueryService insightQueryService;
    private final UserSettingsService userSettingsService;
    private final InsightPipeMetrics metrics;

    public RecommendationService(InsightGenerator insightGenerator,
                                 InsightQueryService insightQueryService,
                                 UserSettingsService userSettingsService,
                                 InsightPipeMetrics metrics) {
        this.insightGenerator = insightGenerator;
        this.insightQueryService = insightQueryService;
        this.userSettingsService = userSettingsService;
        this.metrics = metrics;
    }

    public List<RecommendationResponse> recommendations(UUID userId, ReportPeriod period, LocalDate at) {
        log.debug("recommendations requested: userId={}, period={}, at={}", userId, period, at);
        LocalDate anchor = at != null ? at : LocalDate.now();
        boolean llmEnabled = userSettingsService.isLlmEnabled(userId);
        LocalDate monthStart = anchor.withDayOfMonth(1);
        boolean hasBudget = insightQueryService.getMonthlyBudget(userId, monthStart).isPresent();
        List<RecommendationResponse> recommendations = insightGenerator.feed(userId, period, anchor, llmEnabled)
                .stream()
                .filter(card -> card.question() == InsightQuestion.ACTION
                        || card.question() == InsightQuestion.NEXT)
                .map(card -> new RecommendationResponse(card, actionFor(card, hasBudget)))
                .toList();
        metrics.recommendationViewed();
        log.debug("Recommendations built: userId={}, count={}, hasBudget={}",
                userId, recommendations.size(), hasBudget);
        return recommendations;
    }

    private String actionFor(InsightCardResponse card, boolean hasBudget) {
        if (card.question() == InsightQuestion.ACTION) {
            if ("Uncategorized".equals(card.label())) {
                return "categorize_transactions";
            }
            if (!hasBudget) {
                return "set_budget";
            }
            return "over_budget".equals(card.factId()) ? "cut_spending" : "review_budget";
        }
        return switch (card.question()) {
            case NEXT -> "cancel_subscription";
            default -> "review";
        };
    }
}