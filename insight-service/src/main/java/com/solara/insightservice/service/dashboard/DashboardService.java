package com.solara.insightservice.service.dashboard;

import com.solara.insightservice.config.TracedExecutors;
import com.solara.insightservice.dto.response.BudgetResponse;
import com.solara.insightservice.dto.response.DashboardResponse;
import com.solara.insightservice.dto.response.DashboardSection;
import com.solara.insightservice.dto.response.IncomeResponse;
import com.solara.insightservice.dto.response.SafeToSpendResponse;
import com.solara.insightservice.dto.response.TrendsResponse;
import com.solara.insightservice.exception.AiInsightsDisabledException;
import com.solara.insightservice.model.ReportPeriod;
import com.solara.insightservice.service.finance.FinanceQueryService;
import com.solara.insightservice.service.finance.SubscriptionService;
import com.solara.insightservice.service.insight.InsightFacade;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;

@Service
public class DashboardService {

    private static final Logger log = LoggerFactory.getLogger(DashboardService.class);

    private static final long NUMERIC_SECTION_TIMEOUT_MILLIS = 30_000;
    private static final long AI_SECTION_TIMEOUT_MILLIS = 60_000;

    private final FinanceQueryService queryService;
    private final SubscriptionService subscriptionService;
    private final InsightFacade insightFacade;
    private final Executor sectionExecutor;

    public DashboardService(FinanceQueryService queryService, SubscriptionService subscriptionService,
                            InsightFacade insightFacade) {
        this.queryService = queryService;
        this.subscriptionService = subscriptionService;
        this.insightFacade = insightFacade;
        this.sectionExecutor = TracedExecutors.decorated(Executors.newThreadPerTaskExecutor(
                Thread.ofVirtual().name("dashboard-", 0).factory()));
    }

    public DashboardResponse get(UUID userId, ReportPeriod period, LocalDate at) {
        LocalDate anchor = at != null ? at : LocalDate.now();
        LocalDate monthStart = anchor.withDayOfMonth(1);
        YearMonth month = YearMonth.from(anchor);

        Map<String, DashboardSection> sections = new LinkedHashMap<>();
        sections.put("availableDates", run("availableDates",
                () -> queryService.getAvailableDates(userId), NUMERIC_SECTION_TIMEOUT_MILLIS));
        sections.put("income", run("income",
                () -> new IncomeResponse(userId,
                        queryService.getMonthlyIncome(userId, monthStart).orElse(BigDecimal.ZERO)),
                NUMERIC_SECTION_TIMEOUT_MILLIS));
        sections.put("budget", run("budget",
                () -> new BudgetResponse(userId, queryService.sumTotalSpent(userId, monthStart),
                        queryService.getMonthlyBudget(userId, monthStart).orElse(BigDecimal.ZERO)),
                NUMERIC_SECTION_TIMEOUT_MILLIS));
        sections.put("safeToSpend", run("safeToSpend",
                () -> new SafeToSpendResponse(userId, queryService.calculateSafeToSpend(userId, anchor),
                        queryService.upcomingRecurringCosts(userId, month),
                        queryService.upcomingRecurringCostsByKind(userId, month), "MONTHLY"),
                NUMERIC_SECTION_TIMEOUT_MILLIS));
        sections.put("trends", run("trends",
                () -> new TrendsResponse(userId, monthStart, month.atEndOfMonth(),
                        queryService.getTrends(userId, monthStart, month.atEndOfMonth())),
                NUMERIC_SECTION_TIMEOUT_MILLIS));
        sections.put("subscriptions", run("subscriptions",
                () -> subscriptionService.listTracked(userId), NUMERIC_SECTION_TIMEOUT_MILLIS));
        sections.put("overview", run("overview",
                () -> insightFacade.overview(userId, period, anchor, false), AI_SECTION_TIMEOUT_MILLIS));

        log.debug("dashboard aggregated: userId={}, period={}, at={}, okSections={}/{}",
                userId, period, anchor, okCount(sections), sections.size());
        return new DashboardResponse(userId, period, anchor, sections);
    }

    private DashboardSection run(String sectionName, Supplier<Object> task, long timeoutMillis) {
        CompletableFuture<DashboardSection> section = CompletableFuture.supplyAsync(task, sectionExecutor)
                .orTimeout(timeoutMillis, TimeUnit.MILLISECONDS)
                .handle((result, error) -> {
                    if (error == null) {
                        return DashboardSection.ok(result);
                    }
                    Throwable root = error instanceof CompletionException completion
                            ? completion.getCause() != null ? completion.getCause() : completion
                            : error;
                    if (root instanceof TimeoutException timeout) {
                        log.warn("Dashboard section timed out: section={}, timeoutMillis={}", sectionName, timeoutMillis);
                        return DashboardSection.unavailable("TIMEOUT",
                                "Section took longer than " + timeoutMillis / 1000 + " seconds", true);
                    }
                    if (root instanceof AiInsightsDisabledException aiDisabled) {
                        log.info("Dashboard section unavailable: section={}, code=AI_DISABLED", sectionName);
                        return DashboardSection.unavailable("AI_DISABLED", aiDisabled.getMessage(), false);
                    }
                    log.error("Dashboard section failed: section={}", sectionName, error);
                    return DashboardSection.unavailable("INTERNAL", "Section failed to load", false);
                });
        return section.join();
    }

    private int okCount(Map<String, DashboardSection> sections) {
        return (int) sections.values().stream()
                .filter(section -> section.status() != null && section.status().wireValue().equals("ok"))
                .count();
    }
}
