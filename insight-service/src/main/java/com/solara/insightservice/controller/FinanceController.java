package com.solara.insightservice.controller;

import com.solara.insightservice.dto.request.BudgetUpdateRequest;
import com.solara.insightservice.dto.request.IncomeUpdateRequest;
import com.solara.insightservice.dto.request.SubscriptionRequest;
import com.solara.insightservice.dto.response.BudgetResponse;
import com.solara.insightservice.dto.response.IncomeResponse;
import com.solara.insightservice.dto.response.SubscriptionResponse;
import com.solara.insightservice.dto.response.TrackedSubscriptionResponse;
import com.solara.insightservice.service.finance.FinanceQueryService;
import com.solara.insightservice.service.finance.SubscriptionSuggester;
import com.solara.insightservice.service.finance.SubscriptionService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/insights")
public class FinanceController {

    private final FinanceQueryService queryService;
    private final SubscriptionSuggester subscriptionSuggester;
    private final SubscriptionService subscriptionService;

    private static final Logger log = LoggerFactory.getLogger(FinanceController.class);

    public FinanceController(FinanceQueryService queryService, SubscriptionSuggester subscriptionSuggester,
                              SubscriptionService subscriptionService) {
        this.queryService = queryService;
        this.subscriptionSuggester = subscriptionSuggester;
        this.subscriptionService = subscriptionService;
    }

    @GetMapping("/subscriptions")
    public ResponseEntity<List<SubscriptionResponse>> subscriptions(@RequestParam UUID userId) {
        log.debug("subscriptions requested: userId={}", userId);
        List<SubscriptionResponse> subscriptions = subscriptionSuggester.suggest(userId);
        log.debug("subscriptions returned: userId={}, count={}", userId, subscriptions.size());
        return ResponseEntity.ok(subscriptions);
    }

    @GetMapping("/tracked-subscriptions")
    public ResponseEntity<List<TrackedSubscriptionResponse>> trackedSubscriptions(@RequestParam UUID userId) {
        log.debug("tracked-subscriptions requested: userId={}", userId);
        List<TrackedSubscriptionResponse> subscriptions = subscriptionService.listTracked(userId);
        log.debug("tracked-subscriptions returned: userId={}, count={}", userId, subscriptions.size());
        return ResponseEntity.ok(subscriptions);
    }

    @PostMapping("/tracked-subscriptions")
    public ResponseEntity<TrackedSubscriptionResponse> createTrackedSubscription(
            @RequestParam UUID userId,
            @Valid @RequestBody SubscriptionRequest request) {
        log.debug("tracked-subscription create requested: userId={}, merchant={}", userId, request.merchant());
        TrackedSubscriptionResponse created = subscriptionService.createTracked(userId, request);
        return ResponseEntity.ok(created);
    }

    @PatchMapping("/tracked-subscriptions/{subscriptionId}")
    public ResponseEntity<TrackedSubscriptionResponse> updateTrackedSubscription(
            @RequestParam UUID userId,
            @PathVariable UUID subscriptionId,
            @Valid @RequestBody SubscriptionRequest request) {
        log.debug("tracked-subscription update requested: userId={}, subscriptionId={}, merchant={}",
                userId, subscriptionId, request.merchant());
        TrackedSubscriptionResponse updated = subscriptionService.updateTracked(userId, subscriptionId, request);
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/tracked-subscriptions/{subscriptionId}/cancel")
    public ResponseEntity<TrackedSubscriptionResponse> cancelTrackedSubscription(
            @RequestParam UUID userId,
            @PathVariable UUID subscriptionId) {
        log.debug("tracked-subscription cancel requested: userId={}, subscriptionId={}", userId, subscriptionId);
        TrackedSubscriptionResponse cancelled = subscriptionService.cancelTracked(userId, subscriptionId);
        return ResponseEntity.ok(cancelled);
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
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate at,
            @Valid @RequestBody BudgetUpdateRequest request) {
        BigDecimal budget = request.budget();
        LocalDate monthStart = at != null ? at.withDayOfMonth(1) : YearMonth.now().atDay(1);
        log.info("budget set requested: userId={}, budget={}, monthStart={}", userId, budget, monthStart);
        queryService.setMonthlyBudget(userId, budget, monthStart);
        BigDecimal totalSpent = queryService.sumTotalSpent(userId, monthStart);
        return ResponseEntity.ok(new BudgetResponse(userId, totalSpent, budget));
    }

    @GetMapping("/income")
    public ResponseEntity<IncomeResponse> getIncome(
            @RequestParam UUID userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate at) {
        log.debug("income get requested: userId={}, at={}", userId, at);
        LocalDate monthStart = at != null ? at.withDayOfMonth(1) : YearMonth.now().atDay(1);
        BigDecimal monthlyIncome = queryService.getMonthlyIncome(userId, monthStart).orElse(BigDecimal.ZERO);
        return ResponseEntity.ok(new IncomeResponse(userId, monthlyIncome));
    }

    @PutMapping("/income")
    public ResponseEntity<IncomeResponse> setIncome(
            @RequestParam UUID userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate at,
            @Valid @RequestBody IncomeUpdateRequest request) {
        BigDecimal income = request.income();
        LocalDate monthStart = at != null ? at.withDayOfMonth(1) : YearMonth.now().atDay(1);
        log.info("income set requested: userId={}, income={}, monthStart={}", userId, income, monthStart);
        queryService.setMonthlyIncome(userId, income, monthStart);
        return ResponseEntity.ok(new IncomeResponse(userId, income));
    }
}
