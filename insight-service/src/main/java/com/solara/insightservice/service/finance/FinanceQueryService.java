package com.solara.insightservice.service.finance;

import com.solara.insightservice.dto.response.AvailableDateResponse;
import com.solara.insightservice.model.BudgetSetting;
import com.solara.insightservice.model.Subscription;
import com.solara.insightservice.model.SubscriptionStatus;
import com.solara.insightservice.model.TransactionCategory;
import com.solara.insightservice.repository.BudgetSettingsRepository;
import com.solara.insightservice.repository.CategorizedTransactionRepository;
import com.solara.insightservice.repository.SubscriptionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.MathContext;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class FinanceQueryService {

    private static final Logger log = LoggerFactory.getLogger(FinanceQueryService.class);

    private static final List<TransactionCategory> EXPENSE_EXCLUDED =
            List.of(TransactionCategory.INVESTMENT);

    private static final List<TransactionCategory> CATEGORY_SUM_EXCLUDED =
            List.of(TransactionCategory.BUDGET, TransactionCategory.INVESTMENT);

    private final CategorizedTransactionRepository transactionRepository;
    private final BudgetSettingsRepository budgetSettingsRepository;
    private final SubscriptionRepository subscriptionRepository;

    public FinanceQueryService(CategorizedTransactionRepository transactionRepository,
                               BudgetSettingsRepository budgetSettingsRepository,
                               SubscriptionRepository subscriptionRepository) {
        this.transactionRepository = transactionRepository;
        this.budgetSettingsRepository = budgetSettingsRepository;
        this.subscriptionRepository = subscriptionRepository;
    }

    public BigDecimal sumTotalSpent(UUID userId, LocalDate monthStart) {
        long start = System.currentTimeMillis();
        BigDecimal spent = netExpenses(userId,
                monthStart.atStartOfDay(ZoneOffset.UTC).toInstant(),
                monthStart.plusMonths(1).atStartOfDay(ZoneOffset.UTC).toInstant());
        log.debug("Total spent: userId={}, month={}, spent={}, durationMs={}",
                userId, monthStart, spent, System.currentTimeMillis() - start);
        return spent;
    }

    public Optional<BigDecimal> getMonthlyBudget(UUID userId, LocalDate monthStart) {
        return budgetSettingsRepository.findByUserIdAndMonthStart(userId, monthStart)
                .map(BudgetSetting::getMonthlyBudget)
                .or(() -> budgetSettingsRepository
                        .findTopByUserIdAndMonthlyBudgetIsNotNullOrderByMonthStartDesc(userId)
                        .map(BudgetSetting::getMonthlyBudget));
    }

    @Transactional
    public void setMonthlyBudget(UUID userId, BigDecimal budget, LocalDate monthStart) {
        budgetSettingsRepository.upsertBudget(UUID.randomUUID(), userId, monthStart, budget);
        log.info("Monthly budget set: userId={}, month={}, budget={}", userId, monthStart, budget);
    }

    public Optional<BigDecimal> getMonthlyIncome(UUID userId) {
        return getMonthlyIncome(userId, currentMonthStart());
    }

    public Optional<BigDecimal> getMonthlyIncome(UUID userId, LocalDate monthStart) {
        return budgetSettingsRepository.findByUserIdAndMonthStart(userId, monthStart)
                .map(BudgetSetting::getMonthlyIncome)
                .or(() -> budgetSettingsRepository
                        .findTopByUserIdAndMonthlyIncomeIsNotNullOrderByMonthStartDesc(userId)
                        .map(BudgetSetting::getMonthlyIncome));
    }

    @Transactional
    public void setMonthlyIncome(UUID userId, BigDecimal income) {
        setMonthlyIncome(userId, income, currentMonthStart());
    }

    @Transactional
    public void setMonthlyIncome(UUID userId, BigDecimal income, LocalDate monthStart) {
        budgetSettingsRepository.upsertIncome(UUID.randomUUID(), userId, monthStart, income);
        log.info("Monthly income set: userId={}, month={}, income={}", userId, monthStart, income);
    }

    public BigDecimal calculateSafeToSpend(UUID userId, LocalDate at) {
        LocalDate targetMonth = at != null ? at.withDayOfMonth(1) : YearMonth.now().atDay(1);
        YearMonth ym = YearMonth.from(targetMonth);
        Instant monthStart = ym.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant monthEnd = ym.plusMonths(1).atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        BigDecimal expenses = netExpenses(userId, monthStart, monthEnd);
        BigDecimal recurring = upcomingRecurringCosts(userId, ym);

        Optional<BigDecimal> budget = getMonthlyBudget(userId, targetMonth);
        if (budget.isPresent() && budget.get().compareTo(BigDecimal.ZERO) > 0) {
            return budget.get().subtract(expenses).subtract(recurring);
        }

        Optional<BigDecimal> storedIncome = getMonthlyIncome(userId, targetMonth);
        if (storedIncome.isPresent() && storedIncome.get().compareTo(BigDecimal.ZERO) > 0) {
            return storedIncome.get().subtract(expenses).subtract(recurring);
        }

        return BigDecimal.ZERO;
    }

    public BigDecimal upcomingRecurringCosts(UUID userId, YearMonth month) {
        LocalDate monthStart = month.atDay(1);
        LocalDate monthEnd = month.atEndOfMonth();
        List<Subscription> active = subscriptionRepository.findByUserIdAndStatus(userId, SubscriptionStatus.ACTIVE);
        BigDecimal reserve = BigDecimal.ZERO;
        for (Subscription subscription : active) {
            LocalDate occurrence = subscription.getNextExpectedDate();
            if (occurrence == null) {
                continue;
            }
            int guard = 0;
            while (!occurrence.isAfter(monthEnd) && guard < 400) {
                if (!occurrence.isBefore(monthStart)) {
                    reserve = reserve.add(subscription.getAmount());
                }
                occurrence = occurrence.plus(subscription.getFrequency().getPeriod());
                guard++;
            }
        }
        return reserve;
    }

    public Map<String, BigDecimal> upcomingRecurringCostsByKind(UUID userId, YearMonth month) {
        LocalDate monthStart = month.atDay(1);
        LocalDate monthEnd = month.atEndOfMonth();
        List<Subscription> active = subscriptionRepository.findByUserIdAndStatus(userId, SubscriptionStatus.ACTIVE);
        Map<String, BigDecimal> result = new LinkedHashMap<>();
        for (Subscription subscription : active) {
            LocalDate occurrence = subscription.getNextExpectedDate();
            if (occurrence == null) {
                continue;
            }
            BigDecimal kindTotal = BigDecimal.ZERO;
            int guard = 0;
            while (!occurrence.isAfter(monthEnd) && guard < 400) {
                if (!occurrence.isBefore(monthStart)) {
                    kindTotal = kindTotal.add(subscription.getAmount());
                }
                occurrence = occurrence.plus(subscription.getFrequency().getPeriod());
                guard++;
            }
            if (kindTotal.compareTo(BigDecimal.ZERO) > 0) {
                result.merge(subscription.getKind().name(), kindTotal, BigDecimal::add);
            }
        }
        return result;
    }

    public Map<TransactionCategory, BigDecimal> getTrends(UUID userId, LocalDate from, LocalDate to) {
        return netCategoryTotals(userId,
                from.atStartOfDay(ZoneOffset.UTC).toInstant(),
                to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant());
    }

    public List<AvailableDateResponse> getAvailableDates(UUID userId) {
        List<Object[]> rows = transactionRepository.findDistinctYearMonth(userId);
        return rows.stream()
                .map(row -> new AvailableDateResponse(((Number) row[0]).intValue(), ((Number) row[1]).intValue()))
                .sorted((a, b) -> {
                    int cmp = Integer.compare(b.year(), a.year());
                    return cmp != 0 ? cmp : Integer.compare(b.month(), a.month());
                })
                .toList();
    }

    private LocalDate currentMonthStart() {
        return YearMonth.now().atDay(1);
    }

    private BigDecimal netExpenses(UUID userId, Instant from, Instant to) {
        BigDecimal debits = transactionRepository.sumAmountByUserAndTypeAndPeriod(
                userId, "DEBIT", EXPENSE_EXCLUDED, from, to);
        BigDecimal credits = transactionRepository.sumAmountByUserAndTypeAndPeriod(
                userId, "CREDIT", EXPENSE_EXCLUDED, from, to);
        return debits.subtract(credits).max(BigDecimal.ZERO);
    }

    private Map<TransactionCategory, BigDecimal> netCategoryTotals(UUID userId, Instant from, Instant to) {
        Map<TransactionCategory, BigDecimal> totals = new HashMap<>();
        addCategorySums(totals, transactionRepository.sumByCategoryAndTypeBetween(
                userId, "DEBIT", CATEGORY_SUM_EXCLUDED, from, to));
        Map<TransactionCategory, BigDecimal> credits = new HashMap<>();
        addCategorySums(credits, transactionRepository.sumByCategoryAndTypeBetween(
                userId, "CREDIT", CATEGORY_SUM_EXCLUDED, from, to));
        totals.replaceAll((category, debits) ->
                debits.subtract(credits.getOrDefault(category, BigDecimal.ZERO)).max(BigDecimal.ZERO));
        totals.entrySet().removeIf(entry -> entry.getValue().signum() == 0);
        return totals;
    }

    private void addCategorySums(Map<TransactionCategory, BigDecimal> totals, List<Object[]> rows) {
        for (Object[] row : rows) {
            TransactionCategory category = row[0] != null
                    ? (TransactionCategory) row[0]
                    : TransactionCategory.UNCATEGORIZED;
            totals.merge(category, (BigDecimal) row[1], BigDecimal::add);
        }
    }
}