package com.solara.insightservice.service;

import com.solara.insightservice.model.Projection;
import com.solara.insightservice.model.TransactionCategory;
import com.solara.insightservice.repository.CategorizedTransactionRepository;
import com.solara.insightservice.repository.ProjectionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ProjectionService {

    private static final Logger log = LoggerFactory.getLogger(ProjectionService.class);

    private final ProjectionRepository projectionRepository;
    private final CategorizedTransactionRepository transactionRepository;

    public ProjectionService(ProjectionRepository projectionRepository,
                             CategorizedTransactionRepository transactionRepository) {
        this.projectionRepository = projectionRepository;
        this.transactionRepository = transactionRepository;
    }

    public void upsertAll(UUID userId, TransactionCategory category, BigDecimal amount,
                          Instant transactionTime, String transactionType) {
        LocalDate monthStart = YearMonth.from(transactionTime.atZone(ZoneId.of("UTC"))).atDay(1);
        LocalDate weekStart = weekStart(transactionTime);

        projectionRepository.upsert(
                UUID.randomUUID(), userId, category.name(), "MONTHLY", monthStart, transactionType, amount
        );
        projectionRepository.upsert(
                UUID.randomUUID(), userId, category.name(), "WEEKLY", weekStart, transactionType, amount
        );

        log.debug("Upserted projections: userId={}, category={}, type={}, amount={}",
                userId, category, transactionType, amount);
    }

    private LocalDate weekStart(Instant transactionTime) {
        int dayOfMonth = transactionTime.atZone(ZoneId.of("UTC")).getDayOfMonth();
        LocalDate monthStart = YearMonth.from(transactionTime.atZone(ZoneId.of("UTC"))).atDay(1);
        if (dayOfMonth <= 7) return monthStart;
        if (dayOfMonth <= 14) return monthStart.plusDays(7);
        if (dayOfMonth <= 21) return monthStart.plusDays(14);
        return monthStart.plusDays(21);
    }

    private LocalDate currentMonthStart() {
        return YearMonth.now().atDay(1);
    }

    public BigDecimal sumTotalSpent(UUID userId, LocalDate monthStart) {
        return projectionRepository.sumTotalAmountByPeriod(userId, monthStart);
    }

    public Optional<BigDecimal> getMonthlyBudget(UUID userId, LocalDate monthStart) {
        return projectionRepository.findMonthlyBudget(userId, monthStart);
    }

    @Transactional
    public void setMonthlyBudget(UUID userId, BigDecimal budget) {
        projectionRepository.upsertBudget(UUID.randomUUID(), userId, currentMonthStart(), budget);
    }

    public Optional<BigDecimal> getMonthlyIncome(UUID userId) {
        return projectionRepository.findMonthlyIncome(userId, currentMonthStart());
    }

    @Transactional
    public void setMonthlyIncome(UUID userId, BigDecimal income) {
        projectionRepository.upsertIncome(UUID.randomUUID(), userId, currentMonthStart(), income);
    }

    public BigDecimal calculateSafeToSpend(UUID userId, LocalDate at) {
        LocalDate targetMonth = at != null ? at.withDayOfMonth(1) : YearMonth.now().atDay(1);
        YearMonth ym = YearMonth.from(targetMonth);
        Instant monthStart = ym.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant monthEnd = ym.plusMonths(1).atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        BigDecimal expenses = transactionRepository.sumAmountByUserAndTypeAndPeriod(userId, "DEBIT", monthStart, monthEnd);

        Optional<BigDecimal> budget = getMonthlyBudget(userId, targetMonth);
        if (budget.isPresent() && budget.get().compareTo(BigDecimal.ZERO) > 0) {
            return budget.get().subtract(expenses);
        }

        Optional<BigDecimal> storedIncome = getMonthlyIncome(userId);
        if (storedIncome.isPresent() && storedIncome.get().compareTo(BigDecimal.ZERO) > 0) {
            return storedIncome.get().subtract(expenses);
        }

        BigDecimal income = transactionRepository.sumAmountByUserAndTypeAndPeriod(userId, "CREDIT", monthStart, monthEnd);
        return income.subtract(expenses);
    }

    public Map<TransactionCategory, BigDecimal> getTrends(UUID userId, LocalDate from, LocalDate to) {
        List<Projection> projections = projectionRepository
                .findByUserIdAndPeriodAndPeriodStartBetween(userId, "MONTHLY", from, to);

        return projections.stream()
                .filter(projection -> "DEBIT".equals(projection.getTransactionType()))
                .filter(projection -> TransactionCategory.BUDGET != projection.getCategory())
                .collect(Collectors.groupingBy(Projection::getCategory,
                        Collectors.reducing(BigDecimal.ZERO, Projection::getTotalAmount, BigDecimal::add)));
    }
}
