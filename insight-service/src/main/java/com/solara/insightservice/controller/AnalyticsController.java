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
import com.solara.insightservice.service.insight.InsightGenerator;
import com.solara.insightservice.service.finance.FinanceQueryService;
import com.solara.insightservice.service.insight.surface.OverviewService;
import com.solara.insightservice.service.ratelimit.RegenerationRateLimiter;
import com.solara.insightservice.service.report.ReportService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import reactor.core.Disposable;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/v1/insights")
public class AnalyticsController {

    private final FinanceQueryService queryService;
    private final ReportService reportService;
    private final OverviewService overviewService;
    private final InsightGenerator insightGenerator;
    private final RegenerationRateLimiter regenerationRateLimiter;

    private static final Logger log = LoggerFactory.getLogger(AnalyticsController.class);

    public AnalyticsController(FinanceQueryService queryService, ReportService reportService,
                               OverviewService overviewService, InsightGenerator insightGenerator,
                               RegenerationRateLimiter regenerationRateLimiter) {
        this.queryService = queryService;
        this.reportService = reportService;
        this.overviewService = overviewService;
        this.insightGenerator = insightGenerator;
        this.regenerationRateLimiter = regenerationRateLimiter;
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
        if (refresh) {
            regenerationRateLimiter.consume(userId);
        }
        return ResponseEntity.ok(overviewService.overview(userId, period, at, refresh));
    }

    @GetMapping(value = "/overview/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter overviewStream(
            @RequestParam UUID userId,
            @RequestParam ReportPeriod period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate at,
            @RequestParam(defaultValue = "false") boolean refresh) {
        log.debug("overview stream requested: userId={}, period={}, at={}, refresh={}", userId, period, at, refresh);
        if (refresh) {
            regenerationRateLimiter.consume(userId);
        }
        SseEmitter emitter = new SseEmitter(300_000L);
        ScheduledExecutorService heartbeatScheduler =
                Executors.newSingleThreadScheduledExecutor(Thread.ofVirtual().factory());
        Runnable heartbeat = () -> {
            try {
                emitter.send(SseEmitter.event().comment("hb"));
            } catch (IOException e) {
                emitter.completeWithError(e);
            }
        };
        Disposable subscription = overviewService.overviewStream(userId, period, at, refresh)
                .subscribe(
                        card -> {
                            try {
                                emitter.send(SseEmitter.event().data(card).name("card"));
                            } catch (IOException e) {
                                log.warn("SSE send failed: {}", e.getMessage());
                                emitter.completeWithError(e);
                            }
                        },
                        emitter::completeWithError,
                        () -> {
                            try {
                                emitter.send(SseEmitter.event().name("done").data("[DONE]"));
                                emitter.complete();
                            } catch (IOException e) {
                                emitter.completeWithError(e);
                            }
                        }
                );
        heartbeatScheduler.scheduleAtFixedRate(heartbeat, 15, 15, TimeUnit.SECONDS);
        emitter.onCompletion(() -> {
            subscription.dispose();
            heartbeatScheduler.shutdownNow();
        });
        emitter.onTimeout(() -> {
            log.debug("SSE stream timed out: userId={}", userId);
            subscription.dispose();
            heartbeatScheduler.shutdownNow();
            emitter.complete();
        });
        emitter.onError(error -> {
            log.debug("SSE stream errored: userId={}, error={}", userId, error.getMessage());
            subscription.dispose();
            heartbeatScheduler.shutdownNow();
        });
        return emitter;
    }

    @GetMapping("/available-dates")
    public ResponseEntity<List<AvailableDateResponse>> getAvailableDates(@RequestParam UUID userId) {
        log.debug("available-dates requested: userId={}", userId);
        List<AvailableDateResponse> availableDates = queryService.getAvailableDates(userId);
        log.debug("available-dates returned: userId={}, count={}", userId, availableDates.size());
        return ResponseEntity.ok(availableDates);
    }
}
