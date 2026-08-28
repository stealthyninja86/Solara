package com.solara.insightservice.service.insight;

import com.solara.insightservice.dto.response.InsightCardResponse;
import com.solara.insightservice.dto.response.RecommendationResponse;
import com.solara.insightservice.dto.response.UserSettingsResponse;
import com.solara.insightservice.exception.AiInsightsDisabledException;
import com.solara.insightservice.metrics.InsightPipeMetrics;
import com.solara.insightservice.model.InsightType;
import com.solara.insightservice.model.ReportPeriod;
import com.solara.insightservice.service.finance.FinanceQueryService;
import com.solara.insightservice.service.settings.UserSettingsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class InsightFacade {

    private static final Logger log = LoggerFactory.getLogger(InsightFacade.class);

    private final InsightGenerator insightGenerator;
    private final FinanceQueryService financeQueryService;
    private final UserSettingsService userSettingsService;
    private final InsightPipeMetrics metrics;

    public InsightFacade(InsightGenerator insightGenerator,
                                 FinanceQueryService financeQueryService,
                                 UserSettingsService userSettingsService,
                                 InsightPipeMetrics metrics) {
        this.insightGenerator = insightGenerator;
        this.financeQueryService = financeQueryService;
        this.userSettingsService = userSettingsService;
        this.metrics = metrics;
    }

    public boolean isLlmEnabled(UUID userId) {
        return userSettingsService.isLlmEnabled(userId);
    }

    public List<InsightCardResponse> overview(UUID userId, ReportPeriod period, LocalDate at, boolean force) {
        log.debug("overview requested: userId={}, period={}, at={}, force={}", userId, period, at, force);
        List<InsightCardResponse> cards = fetchCards(userId, period, at, InsightType.OVERVIEW, force);
        log.debug("overview returned: userId={}, count={}", userId, cards.size());
        return cards;
    }

    public List<RecommendationResponse> recommendations(UUID userId, ReportPeriod period, LocalDate at, boolean force) {
        log.debug("recommendations requested: userId={}, period={}, at={}, force={}", userId, period, at, force);
        LocalDate anchor = at != null ? at : LocalDate.now();
        LocalDate monthStart = anchor.withDayOfMonth(1);
        boolean hasBudget = financeQueryService.getMonthlyBudget(userId, monthStart).isPresent();
        List<RecommendationResponse> recommendations = fetchCards(userId, period, at, InsightType.RECOMMENDATIONS, force)
                .stream()
                .map(card -> new RecommendationResponse(card, actionFor(card, hasBudget)))
                .toList();
        metrics.recommendationViewed();
        log.debug("recommendations returned: userId={}, count={}, hasBudget={}",
                userId, recommendations.size(), hasBudget);
        return recommendations;
    }

    private List<InsightCardResponse> fetchCards(UUID userId, ReportPeriod period, LocalDate at,
                                                 Set<InsightType> types, boolean force) {
        UserSettingsResponse settings = userSettingsService.fetchSettings(userId);
        if (!userSettingsService.isLlmEnabled(userId)) {
            log.info("Insight surface suppressed: userId={}, types={}, aiSettings=false",
                    userId, InsightType.cacheSuffix(types));
            throw new AiInsightsDisabledException();
        }
        LocalDate anchor = at != null ? at : LocalDate.now();
        return insightGenerator.feed(userId, period, anchor, true, types, force, settings);
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