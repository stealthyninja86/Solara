package com.solara.insightservice.controller;

import com.solara.insightservice.dto.response.AvailableDateResponse;
import com.solara.insightservice.dto.response.InsightCardResponse;
import com.solara.insightservice.dto.response.RecommendationResponse;
import com.solara.insightservice.dto.response.ReportResponse;
import com.solara.insightservice.dto.response.RegenerationStatusResponse;
import com.solara.insightservice.dto.response.SafeToSpendResponse;
import com.solara.insightservice.dto.response.SolaraInsightResponse;
import com.solara.insightservice.dto.response.TrendsResponse;
import com.solara.insightservice.exception.AiInsightsDisabledException;
import com.solara.insightservice.model.ReportPeriod;
import com.solara.insightservice.model.TransactionCategory;
import com.solara.insightservice.service.insight.InsightFacade;
import com.solara.insightservice.service.finance.FinanceQueryService;
import com.solara.insightservice.service.ratelimit.RegenerationRateLimiter;
import com.solara.insightservice.service.report.ReportService;
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

@RestController
@RequestMapping("/api/v1/insights")
public class InsightController {

    private static final Logger log = LoggerFactory.getLogger(InsightController.class);

    private final FinanceQueryService queryService;
    private final ReportService reportService;
    private final InsightFacade insightFacade;
    private final RegenerationRateLimiter regenerationRateLimiter;

    public InsightController(FinanceQueryService queryService, ReportService reportService,
                             InsightFacade insightFacade,
                             RegenerationRateLimiter regenerationRateLimiter) {
        this.queryService = queryService;
        this.reportService = reportService;
        this.insightFacade = insightFacade;
        this.regenerationRateLimiter = regenerationRateLimiter;
    }

    @GetMapping("/regeneration-status")
    public ResponseEntity<RegenerationStatusResponse> regenerationStatus(@RequestParam UUID userId) {
        log.debug("regeneration status requested: userId={}", userId);
        return ResponseEntity.ok(new RegenerationStatusResponse(
                regenerationRateLimiter.limit(),
                regenerationRateLimiter.used(userId)));
    }

    @GetMapping("/safe-to-spend")
    public ResponseEntity<SafeToSpendResponse> safeToSpend(
            @RequestParam UUID userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate at) {
        log.debug("safe-to-spend requested: userId={}, at={}", userId, at);
        YearMonth month = at != null ? YearMonth.from(at) : YearMonth.now();
        BigDecimal safeToSpend = queryService.calculateSafeToSpend(userId, at);
        BigDecimal recurringCosts = queryService.upcomingRecurringCosts(userId, month);
        Map<String, BigDecimal> recurringCostsByKind = queryService.upcomingRecurringCostsByKind(userId, month);
        log.debug("safe-to-spend returned: userId={}, amount={}, recurring={}, byKind={}",
                userId, safeToSpend, recurringCosts, recurringCostsByKind);
        return ResponseEntity.ok(new SafeToSpendResponse(userId, safeToSpend, recurringCosts, recurringCostsByKind, "MONTHLY"));
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
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate at,
            @RequestParam(defaultValue = "false") boolean refresh) {
        if (!insightFacade.isLlmEnabled(userId)) {
            log.info("overview rejected: userId={}, aiSettings=false", userId);
            throw new AiInsightsDisabledException();
        }
        if (refresh) {
            regenerationRateLimiter.consume(userId);
        }
        return ResponseEntity.ok(insightFacade.overview(userId, period, at, refresh));
    }

    @GetMapping("/recommendations")
    public ResponseEntity<List<RecommendationResponse>> recommendations(
            @RequestParam UUID userId,
            @RequestParam ReportPeriod period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate at,
            @RequestParam(defaultValue = "false") boolean refresh) {
        if (!insightFacade.isLlmEnabled(userId)) {
            log.info("recommendations rejected: userId={}, aiSettings=false", userId);
            throw new AiInsightsDisabledException();
        }
        if (refresh) {
            regenerationRateLimiter.consume(userId);
        }
        return ResponseEntity.ok(insightFacade.recommendations(userId, period, at, refresh));
    }

    @GetMapping("/available-dates")
    public ResponseEntity<List<AvailableDateResponse>> getAvailableDates(@RequestParam UUID userId) {
        log.debug("available-dates requested: userId={}", userId);
        List<AvailableDateResponse> availableDates = queryService.getAvailableDates(userId);
        log.debug("available-dates returned: userId={}, count={}", userId, availableDates.size());
        return ResponseEntity.ok(availableDates);
    }
}
