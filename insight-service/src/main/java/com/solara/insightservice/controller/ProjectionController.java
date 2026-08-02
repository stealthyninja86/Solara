package com.solara.insightservice.controller;

import com.solara.insightservice.dto.response.BudgetResponse;
import com.solara.insightservice.dto.response.IncomeResponse;
import com.solara.insightservice.dto.response.ReportResponse;
import com.solara.insightservice.dto.response.SafeToSpendResponse;
import com.solara.insightservice.dto.response.TrendsResponse;
import com.solara.insightservice.model.ReportPeriod;
import com.solara.insightservice.model.TransactionCategory;
import com.solara.insightservice.service.ProjectionService;
import com.solara.insightservice.service.ReportService;
import org.springframework.format.annotation.DateTimeFormat;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/insights")
public class ProjectionController {

    private final ProjectionService queryService;
    private final ReportService reportService;

    private static final Logger log = LoggerFactory.getLogger(ProjectionController.class);

    public ProjectionController(ProjectionService queryService, ReportService reportService) {
        this.queryService = queryService;
        this.reportService = reportService;
    }

    @GetMapping("/safe-to-spend")
    public ResponseEntity<SafeToSpendResponse> safeToSpend(
            @RequestParam UUID userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate at) {
        log.debug("safe-to-spend requested: userId={}, at={}", userId, at);
        BigDecimal safeToSpend = queryService.calculateSafeToSpend(userId, at);
        log.debug("safe-to-spend returned: userId={}, amount={}", userId, safeToSpend);
        return ResponseEntity.ok(new SafeToSpendResponse(userId, safeToSpend, "MONTHLY"));
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

    @GetMapping("/budget")
    public ResponseEntity<BudgetResponse> getBudget(
            @RequestParam UUID userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate at) {
        log.debug("budget get requested: userId={}, at={}", userId, at);
        LocalDate monthStart = at != null ? at.withDayOfMonth(1) : YearMonth.now().atDay(1);
        BigDecimal totalSpent = queryService.sumTotalSpent(userId, monthStart);
        BigDecimal monthlyBudget = queryService.getMonthlyBudget(userId, monthStart).orElse(BigDecimal.ZERO);
        return ResponseEntity.ok(new BudgetResponse(userId, totalSpent, monthlyBudget));
    }

    @PutMapping("/budget")
    public ResponseEntity<BudgetResponse> setBudget(
            @RequestParam UUID userId,
            @RequestBody Map<String, BigDecimal> body) {
        BigDecimal budget = body.getOrDefault("budget", BigDecimal.ZERO);
        log.info("budget set requested: userId={}, budget={}", userId, budget);
        queryService.setMonthlyBudget(userId, budget);
        BigDecimal totalSpent = queryService.sumTotalSpent(userId, YearMonth.now().atDay(1));
        return ResponseEntity.ok(new BudgetResponse(userId, totalSpent, budget));
    }

    @GetMapping("/income")
    public ResponseEntity<IncomeResponse> getIncome(@RequestParam UUID userId) {
        log.debug("income get requested: userId={}", userId);
        BigDecimal monthlyIncome = queryService.getMonthlyIncome(userId).orElse(BigDecimal.ZERO);
        return ResponseEntity.ok(new IncomeResponse(userId, monthlyIncome));
    }

    @PutMapping("/income")
    public ResponseEntity<IncomeResponse> setIncome(
            @RequestParam UUID userId,
            @RequestBody Map<String, BigDecimal> body) {
        BigDecimal income = body.getOrDefault("income", BigDecimal.ZERO);
        log.info("income set requested: userId={}, income={}", userId, income);
        queryService.setMonthlyIncome(userId, income);
        return ResponseEntity.ok(new IncomeResponse(userId, income));
    }
}
