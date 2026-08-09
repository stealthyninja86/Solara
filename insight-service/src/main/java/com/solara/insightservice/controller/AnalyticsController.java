package com.solara.insightservice.controller;

import com.solara.insightservice.dto.response.AiStatusResponse;
import com.solara.insightservice.dto.response.AvailableDateResponse;
import com.solara.insightservice.dto.response.InsightCardResponse;
import com.solara.insightservice.dto.response.ReportResponse;
import com.solara.insightservice.dto.response.SafeToSpendResponse;
import com.solara.insightservice.dto.response.SolaraInsightResponse;
import com.solara.insightservice.dto.response.TrendsResponse;
import com.solara.insightservice.model.ReportPeriod;
import com.solara.insightservice.model.TransactionCategory;
import com.solara.insightservice.service.InsightGenerator;
import com.solara.insightservice.service.InsightQueryService;
import com.solara.insightservice.service.OverviewService;
import com.solara.insightservice.service.ReportService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Read-only analytics surface: AI status, safe-to-spend, trends, reports,
 * insights, the LLM overview feed, and available reporting dates. Split out of
 * the former {@code InsightController} so write surfaces (budget, income,
 * subscriptions) live in {@link FinanceController}.
 */
@RestController
@RequestMapping("/api/v1/insights")
public class AnalyticsController {

    private final InsightQueryService queryService;
    private final ReportService reportService;
    private final OverviewService overviewService;
    private final InsightGenerator insightGenerator;

    private static final Logger log = LoggerFactory.getLogger(AnalyticsController.class);

    public AnalyticsController(InsightQueryService queryService, ReportService reportService,
                               OverviewService overviewService, InsightGenerator insightGenerator) {
        this.queryService = queryService;
        this.reportService = reportService;
        this.overviewService = overviewService;
        this.insightGenerator = insightGenerator;
    }

    @GetMapping("/ai/status")
    public ResponseEntity<AiStatusResponse> aiStatus() {
        log.debug("ai status requested");
        return ResponseEntity.ok(new AiStatusResponse(insightGenerator.isLlmAvailable()));
    }

    @GetMapping("/safe-to-spend")
    public ResponseEntity<SafeToSpendResponse> safeToSpend(
            @RequestParam UUID userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate at) {
        log.debug("safe-to-spend requested: userId={}, at={}", userId, at);
        BigDecimal safeToSpend = queryService.calculateSafeToSpend(userId, at);
        BigDecimal recurringCosts = queryService.upcomingRecurringCosts(userId,
                at != null ? YearMonth.from(at) : YearMonth.now());
        log.debug("safe-to-spend returned: userId={}, amount={}, recurring={}",
                userId, safeToSpend, recurringCosts);
        return ResponseEntity.ok(new SafeToSpendResponse(userId, safeToSpend, recurringCosts, "MONTHLY"));
    }

    @GetMapping("/trends")
    public ResponseEntity<TrendsResponse> trends(
            @RequestParam UUID userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        log.debug("trends requested: userId={}, from={}, to={}", userId, from, to);
        Map<TransactionCategory, BigDecimal> categoryTotals = queryService.getTrends(userId, from, to);
        log.debug("trends returned: userId={}, categories={}", userId, categoryTotals.size());
        return ResponseEntity.ok(new TrendsResponse(userId, from, to, categoryTotals));
    }

    @GetMapping("/report")
    public ResponseEntity<ReportResponse> report(
            @RequestParam UUID userId,
            @RequestParam ReportPeriod period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate at) {
        log.debug("report requested: userId={}, period={}, at={}", userId, period, at);
        LocalDate anchor = at != null ? at : LocalDate.now();
        ReportResponse response = reportService.buildReport(userId, period, anchor);
        log.debug("report returned: userId={}, categories={}, trendPoints={}",
                userId, response.categories().size(), response.trend().size());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/insights")
    public ResponseEntity<List<SolaraInsightResponse>> insights(
            @RequestParam UUID userId,
            @RequestParam ReportPeriod period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate at) {
        log.debug("insights requested: userId={}, period={}, at={}", userId, period, at);
        LocalDate anchor = at != null ? at : LocalDate.now();
        List<SolaraInsightResponse> insights = reportService.buildInsights(userId, period, anchor);
        log.debug("insights returned: userId={}, count={}", userId, insights.size());
        return ResponseEntity.ok(insights);
    }

    @GetMapping("/overview")
    public ResponseEntity<List<InsightCardResponse>> overview(
            @RequestParam UUID userId,
            @RequestParam ReportPeriod period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate at) {
        return ResponseEntity.ok(overviewService.overview(userId, period, at));
    }

    @GetMapping("/available-dates")
    public ResponseEntity<List<AvailableDateResponse>> getAvailableDates(@RequestParam UUID userId) {
        log.debug("available-dates requested: userId={}", userId);
        List<AvailableDateResponse> availableDates = queryService.getAvailableDates(userId);
        log.debug("available-dates returned: userId={}, count={}", userId, availableDates.size());
        return ResponseEntity.ok(availableDates);
    }
}
