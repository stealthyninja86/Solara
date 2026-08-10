package com.solara.insightservice.service.insight.surface;

import com.solara.insightservice.service.insight.InsightGenerator;
import com.solara.insightservice.service.settings.UserSettingsService;
import com.solara.insightservice.dto.response.InsightCardResponse;
import com.solara.insightservice.model.InsightType;
import com.solara.insightservice.model.ReportPeriod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

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

    public List<InsightCardResponse> overview(UUID userId, ReportPeriod period, LocalDate at, boolean force) {
        log.debug("overview requested: userId={}, period={}, at={}, force={}", userId, period, at, force);
        LocalDate anchor = at != null ? at : LocalDate.now();
        boolean llmEnabled = userSettingsService.isLlmEnabled(userId);
        List<InsightCardResponse> cards = insightGenerator.feed(userId, period, anchor, llmEnabled,
                InsightType.OVERVIEW, force);
        log.debug("overview returned: userId={}, count={}", userId, cards.size());
        return cards;
    }

    public Flux<InsightCardResponse> overviewStream(UUID userId, ReportPeriod period, LocalDate at, boolean force) {
        log.debug("overview stream requested: userId={}, period={}, at={}, force={}", userId, period, at, force);
        LocalDate anchor = at != null ? at : LocalDate.now();
        boolean llmEnabled = userSettingsService.isLlmEnabled(userId);
        return insightGenerator.feedStream(userId, period, anchor, llmEnabled, InsightType.OVERVIEW, force);
    }
}
