package com.solara.insightservice.service.insight.surface;

import com.solara.insightservice.dto.response.InsightCardResponse;
import com.solara.insightservice.dto.response.RecommendationResponse;
import com.solara.insightservice.service.finance.FinanceQueryService;
import com.solara.insightservice.service.insight.InsightGenerator;
import com.solara.insightservice.service.settings.UserSettingsService;
import com.solara.insightservice.metrics.InsightPipeMetrics;
import com.solara.insightservice.model.InsightType;
import com.solara.insightservice.model.ReportPeriod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class RecommendationService {

    private static final Logger log = LoggerFactory.getLogger(RecommendationService.class);

    private final InsightGenerator insightGenerator;
    private final FinanceQueryService insightQueryService;
    private final UserSettingsService userSettingsService;
    private final InsightPipeMetrics metrics;

    public RecommendationService(InsightGenerator insightGenerator,
                                 FinanceQueryService insightQueryService,
                                 UserSettingsService userSettingsService,
                                 InsightPipeMetrics metrics) {
        this.insightGenerator = insightGenerator;
        this.insightQueryService = insightQueryService;
        this.userSettingsService = userSettingsService;
        this.metrics = metrics;
    }

    public List<RecommendationResponse> recommendations(UUID userId, ReportPeriod period, LocalDate at, boolean force) {
        log.debug("recommendations requested: userId={}, period={}, at={}, force={}", userId, period, at, force);
        LocalDate anchor = at != null ? at : LocalDate.now();
        boolean llmEnabled = userSettingsService.isLlmEnabled(userId);
        LocalDate monthStart = anchor.withDayOfMonth(1);
        boolean hasBudget = insightQueryService.getMonthlyBudget(userId, monthStart).isPresent();
        List<RecommendationResponse> recommendations = insightGenerator
                .feed(userId, period, anchor, llmEnabled, InsightType.RECOMMENDATIONS, force)
                .stream()
                .map(card -> new RecommendationResponse(card, actionFor(card, hasBudget)))
                .toList();
        metrics.recommendationViewed();
        log.debug("Recommendations built: userId={}, count={}, hasBudget={}",
                userId, recommendations.size(), hasBudget);
        return recommendations;
    }

    private String actionFor(InsightCardResponse card, boolean hasBudget) {
        if ("Uncategorized".equals(card.label())) {
            return "categorize_transactions";
        }
        if (!hasBudget) {
            return "set_budget";
        }
        return "over_budget".equals(card.factId()) ? "cut_spending" : "review_budget";
    }
}