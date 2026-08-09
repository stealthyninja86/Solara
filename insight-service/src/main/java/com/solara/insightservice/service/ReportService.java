package com.solara.insightservice.service;

import com.solara.insightservice.dto.response.ReportCategorySpending;
import com.solara.insightservice.dto.response.ReportRange;
import com.solara.insightservice.dto.response.ReportResponse;
import com.solara.insightservice.dto.response.ReportSummary;
import com.solara.insightservice.dto.response.ReportTrendPoint;
import com.solara.insightservice.dto.response.SolaraInsightResponse;
import com.solara.insightservice.dto.response.SubscriptionResponse;
import com.solara.insightservice.dto.response.InsightFact;
import com.solara.insightservice.model.CategorizedTransaction;
import com.solara.insightservice.model.InsightQuestion;
import com.solara.insightservice.model.ReportPeriod;
import com.solara.insightservice.model.TransactionCategory;
import com.solara.insightservice.repository.CategorizedTransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ReportService {

    private static final Logger log = LoggerFactory.getLogger(ReportService.class);

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final BigDecimal TEN = BigDecimal.valueOf(10);
    private static final BigDecimal TWENTY_FIVE = BigDecimal.valueOf(25);
    private static final BigDecimal FIFTEEN = BigDecimal.valueOf(15);
    private static final long MIN_OBSERVATIONS = 3;
    private static final DecimalFormat RUPEE_FORMAT =
            new DecimalFormat("₹#,##,##0.##", DecimalFormatSymbols.getInstance(Locale.US));

    private final CategorizedTransactionRepository categorizedTransactionRepository;
    private final InsightQueryService insightQueryService;

    public ReportService(CategorizedTransactionRepository categorizedTransactionRepository,
                         InsightQueryService insightQueryService) {
        this.categorizedTransactionRepository = categorizedTransactionRepository;
        this.insightQueryService = insightQueryService;
    }

    public ReportResponse buildReport(UUID userId, ReportPeriod period, LocalDate at) {
        long start = System.currentTimeMillis();
        ReportRange current = currentRange(period, at);
        ReportRange previous = previousRange(period, at);

        Map<TransactionCategory, BigDecimal> currentTotals = totalsByCategory(userId, current);
        Map<TransactionCategory, BigDecimal> previousTotals = totalsByCategory(userId, previous);

        ReportSummary summary = buildSummary(userId, period, current);
        List<ReportCategorySpending> categories = buildCategorySpending(currentTotals, previousTotals);
        List<ReportTrendPoint> trend = buildTrend(userId, period, at);
        log.debug("Report built: userId={}, period={}, at={}, from={}, to={}, categoryCount={}, "
                        + "trendPoints={}, income={}, expenses={}, durationMs={}",
                userId, period, at, current.from(), current.to(), categories.size(), trend.size(),
                summary.income(), summary.expenses(), System.currentTimeMillis() - start);

        return new ReportResponse(userId, period, current.from(), current.to(), summary, categories, trend);
    }

    public List<SubscriptionResponse> buildSubscriptions(UUID userId) {
        long start = System.currentTimeMillis();
        Instant since = Instant.now().minus(365, ChronoUnit.DAYS);
        Map<String, List<CategorizedTransaction>> paymentsByMerchant = categorizedTransactionRepository
                .findDebitsSince(userId, since)
                .stream()
                .filter(transaction -> transaction.getNormalizedMerchant() != null
                        && !transaction.getNormalizedMerchant().isBlank())
                .collect(Collectors.groupingBy(CategorizedTransaction::getNormalizedMerchant));

        List<SubscriptionResponse> result = paymentsByMerchant.values().stream()
                .filter(payments -> payments.size() >= 2)
                .filter(payments -> distinctMonths(payments) >= 2)
                .map(this::toSubscriptionResponse)
                .sorted(Comparator.comparing(SubscriptionResponse::amount, Comparator.reverseOrder()))
                .limit(20)
                .toList();
        log.debug("Subscriptions built: userId={}, candidateMerchants={}, subscriptions={}, durationMs={}",
                userId, paymentsByMerchant.size(), result.size(), System.currentTimeMillis() - start);
        return result;
    }

    public List<SolaraInsightResponse> buildInsights(UUID userId, ReportPeriod period, LocalDate at) {
        long start = System.currentTimeMillis();
        ReportResponse report = buildReport(userId, period, at);
        ReportSummary previous = buildSummary(userId, period, previousRange(period, at));
        List<SolaraInsightResponse> insights = composeInsights(period, report.summary(), previous, report.categories());
        log.debug("Insights built: userId={}, period={}, at={}, insights={}, durationMs={}",
                userId, period, at, insights.size(), System.currentTimeMillis() - start);
        return insights;
    }

    public List<InsightFact> buildFacts(UUID userId, ReportPeriod period, LocalDate at) {
        long start = System.currentTimeMillis();
        ReportResponse report = buildReport(userId, period, at);
        long observationCount = categorizedTransactionRepository.countDebitsSince(
                userId, currentRange(period, at).from().atStartOfDay(ZoneOffset.UTC).toInstant());
        if (observationCount < MIN_OBSERVATIONS) {
            log.debug("Facts suppressed (thin data): userId={}, observations={}", userId, observationCount);
            return List.of();
        }
        List<InsightFact> facts = composeFacts(userId, period, report);
        log.debug("Facts built: userId={}, period={}, at={}, facts={}, observations={}, durationMs={}",
                userId, period, at, facts.size(), observationCount, System.currentTimeMillis() - start);
        return facts;
    }

    private List<SolaraInsightResponse> composeInsights(ReportPeriod period, ReportSummary current,
                                                        ReportSummary previous,
                                                        List<ReportCategorySpending> categories) {
        List<SolaraInsightResponse> insights = new ArrayList<>();
        String periodWord = switch (period) {
            case WEEKLY -> "week";
            case MONTHLY -> "month";
            case YEARLY -> "year";
        };

        boolean hasIncome = current.income().signum() > 0;
        boolean hasExpenses = current.expenses().signum() > 0;

        if (!hasIncome && !hasExpenses) {
            return List.of(new SolaraInsightResponse("suggestion",
                    "No activity yet for this " + periodWord + ".",
                    List.of("Reports are computed from categorized transactions",
                            "Set your monthly income to unlock savings tracking"),
                    "Import your bank statement via Transactions \u2192 Bulk Import."));
        }

        if (hasIncome) {
            int rate = current.savingsRate();
            if (rate >= 20) {
                insights.add(new SolaraInsightResponse("suggestion",
                        "You saved " + rate + "% of your income this " + periodWord + ".",
                        List.of("Saved " + rupees(current.savings()),
                                "20% or more is the healthy benchmark"),
                        "Keep current habits \u2014 consider moving the surplus into investments."));
            } else if (rate >= 0) {
                insights.add(new SolaraInsightResponse("suggestion",
                        "Savings rate is " + rate + "% this " + periodWord + ".",
                        List.of("Saved " + rupees(current.savings()) + " of "
                                + rupees(current.income()) + " income"),
                        "A 10% cut to your top category gets you closer to the 20% benchmark."));
            } else {
                insights.add(new SolaraInsightResponse("anomaly",
                        "Spending exceeded income by " + rupees(current.savings().abs())
                                + " this " + periodWord + ".",
                        List.of("Expenses " + rupees(current.expenses()) + " vs income "
                                + rupees(current.income())),
                        "Review your top categories \u2014 recurring charges are the first place to look."));
            }
        } else if (hasExpenses) {
            insights.add(new SolaraInsightResponse("suggestion",
                    "Your income isn't set for this month.",
                    List.of("Expenses are being tracked at " + rupees(current.expenses())),
                    "Set your monthly income in the Income card to compute savings."));
        }

        if (hasExpenses && !categories.isEmpty()) {
            ReportCategorySpending top = categories.getFirst();
            BigDecimal share = top.amount().multiply(HUNDRED)
                    .divide(current.expenses(), 0, RoundingMode.HALF_UP);
            if (share.compareTo(TWENTY_FIVE) >= 0) {
                BigDecimal cut = top.amount().multiply(TEN).divide(HUNDRED, 0, RoundingMode.HALF_UP);
                String runnerUp = categories.size() > 1
                        ? prettyCategory(categories.get(1).category())
                        : "none";
                insights.add(new SolaraInsightResponse("spending_change",
                        prettyCategory(top.category()) + " is " + share + "% of your spending.",
                        List.of(rupees(top.amount()) + " this " + periodWord,
                                "Next highest category is " + runnerUp),
                        "A 10% cut here saves about " + rupees(cut) + " this " + periodWord + "."));
            }
        }

        if (previous.expenses().signum() > 0) {
            BigDecimal delta = current.expenses().subtract(previous.expenses())
                    .multiply(HUNDRED)
                    .divide(previous.expenses(), 0, RoundingMode.HALF_UP);
            if (delta.abs().compareTo(FIFTEEN) >= 0) {
                boolean rising = delta.signum() > 0;
                insights.add(new SolaraInsightResponse("spending_change",
                        (rising ? "Spending rose " : "Spending fell ") + delta.abs()
                                + "% vs the previous period.",
                        List.of(rupees(current.expenses()) + " now vs "
                                + rupees(previous.expenses()) + " before"),
                        rising
                                ? "Check what changed \u2014 a new subscription or a one-off charge?"
                                : "Whatever worked last period, keep doing it."));
            }
        }

        return insights.stream().limit(3).toList();
    }

    private List<InsightFact> composeFacts(UUID userId, ReportPeriod period, ReportResponse report) {
        List<InsightFact> facts = new ArrayList<>();
        ReportSummary summary = report.summary();
        List<ReportCategorySpending> categories = report.categories();

        if (summary.income().signum() > 0 && summary.savingsRate() >= 20) {
            facts.add(new InsightFact("savings_rate", "Savings rate",
                    rupees(summary.savings()), rupees(summary.income()), null,
                    InsightQuestion.STATUS));
        }
        if (summary.expenses().signum() > 0 && summary.savings().signum() < 0) {
            facts.add(new InsightFact("over_budget", "Spending exceeded income",
                    rupees(summary.savings().abs()), rupees(summary.income()), null,
                    InsightQuestion.ACTION));
        }
        if (!categories.isEmpty()) {
            ReportCategorySpending top = categories.getFirst();
            BigDecimal share = top.amount().multiply(HUNDRED)
                    .divide(summary.expenses(), 0, RoundingMode.HALF_UP);
            if (share.compareTo(TWENTY_FIVE) >= 0) {
                facts.add(new InsightFact("top_category_share",
                        prettyCategory(top.category()),
                        share + "% of spending", rupees(top.amount()),
                        Integer.toString(top.changePercent()), InsightQuestion.ACTION));
            }
        }
        ReportSummary previous = buildSummary(userId, period, previousRange(period, report.from()));
        if (previous.expenses().signum() > 0) {
            BigDecimal delta = summary.expenses().subtract(previous.expenses())
                    .multiply(HUNDRED)
                    .divide(previous.expenses(), 0, RoundingMode.HALF_UP);
            if (delta.abs().compareTo(FIFTEEN) >= 0) {
                facts.add(new InsightFact("spending_delta", "Total spending",
                        rupees(summary.expenses()), rupees(previous.expenses()),
                        delta.toString(), InsightQuestion.NEXT));
            }
        }
        return facts;
    }

    private ReportSummary buildSummary(UUID userId, ReportPeriod period, ReportRange current) {
        BigDecimal income = switch (period) {
            case WEEKLY -> {
                YearMonth month = YearMonth.from(current.from());
                BigDecimal monthIncome = monthlyIncome(userId, month);
                long daysInRange = ChronoUnit.DAYS.between(current.from(), current.to()) + 1;
                yield monthIncome.multiply(BigDecimal.valueOf(daysInRange))
                        .divide(BigDecimal.valueOf(month.lengthOfMonth()), 2, RoundingMode.HALF_UP);
            }
            case MONTHLY -> monthlyIncome(userId, YearMonth.from(current.from()));
            case YEARLY -> {
                BigDecimal total = BigDecimal.ZERO;
                for (int month = 1; month <= 12; month++) {
                    total = total.add(monthlyIncome(userId, YearMonth.of(current.from().getYear(), month)));
                }
                yield total;
            }
        };
        BigDecimal expenses = netExpenses(userId, current);
        BigDecimal savings = income.subtract(expenses);
        int savingsRate = income.signum() > 0
                ? savings.multiply(HUNDRED).divide(income, 0, RoundingMode.HALF_UP).intValue()
                : 0;
        return new ReportSummary(income, expenses, savings, savingsRate);
    }

    private List<ReportCategorySpending> buildCategorySpending(
            Map<TransactionCategory, BigDecimal> current,
            Map<TransactionCategory, BigDecimal> previous) {
        return current.entrySet().stream()
                .map(entry -> {
                    BigDecimal previousAmount = previous.getOrDefault(entry.getKey(), BigDecimal.ZERO);
                    int changePercent = changePercent(entry.getValue(), previousAmount);
                    return new ReportCategorySpending(entry.getKey(), entry.getValue(), previousAmount, changePercent);
                })
                .sorted(Comparator.comparing(ReportCategorySpending::amount, Comparator.reverseOrder()))
                .toList();
    }

    private List<ReportTrendPoint> buildTrend(UUID userId, ReportPeriod period, LocalDate at) {
        List<ReportTrendPoint> points = new ArrayList<>();
        switch (period) {
            case WEEKLY -> {
                YearMonth month = YearMonth.from(at);
                ReportRange week = currentRange(ReportPeriod.WEEKLY, at);
                BigDecimal monthIncome = monthlyIncome(userId, month);
                BigDecimal dailyIncome = monthIncome
                        .divide(BigDecimal.valueOf(month.lengthOfMonth()), 2, RoundingMode.HALF_UP);
                long daysInWeek = ChronoUnit.DAYS.between(week.from(), week.to()) + 1;
                for (int dayOffset = 0; dayOffset < daysInWeek; dayOffset++) {
                    LocalDate day = week.from().plusDays(dayOffset);
                    ReportRange dayRange = new ReportRange(day, day);
                    BigDecimal expenses = netExpenses(userId, dayRange);
                    points.add(new ReportTrendPoint(String.valueOf(day.getDayOfMonth()), dailyIncome, expenses));
                }
            }
            case MONTHLY -> {
                YearMonth month = YearMonth.from(at);
                BigDecimal monthIncome = monthlyIncome(userId, month);
                BigDecimal dailyIncome = monthIncome
                        .divide(BigDecimal.valueOf(month.lengthOfMonth()), 2, RoundingMode.HALF_UP);
                int weeks = weeksInMonth(month);
                for (int bucket = 0; bucket < weeks; bucket++) {
                    ReportRange bucketRange = ReportRange.weekOf(month, bucket);
                    long daysInBucket = ChronoUnit.DAYS.between(bucketRange.from(), bucketRange.to()) + 1;
                    BigDecimal bucketIncome = dailyIncome.multiply(BigDecimal.valueOf(daysInBucket));
                    points.add(trendPoint(userId, bucketRange,
                            bucketIncome, String.format(Locale.ROOT, "W%d", bucket + 1)));
                }
            }
            case YEARLY -> {
                int year = at.getYear();
                String[] monthLabels = {"Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
                for (int monthIndex = 0; monthIndex < 12; monthIndex++) {
                    YearMonth bucketMonth = YearMonth.of(year, monthIndex + 1);
                    BigDecimal monthIncome = monthlyIncome(userId, bucketMonth);
                    points.add(trendPoint(userId, ReportRange.of(bucketMonth), monthIncome,
                            monthLabels[monthIndex]));
                }
            }
        }
        return points;
    }

    private ReportTrendPoint trendPoint(UUID userId, ReportRange range,
                                        BigDecimal income, String label) {
        BigDecimal expenses = netExpenses(userId, range);
        return new ReportTrendPoint(label, income, expenses);
    }

    private BigDecimal monthlyIncome(UUID userId, YearMonth month) {
        return insightQueryService.getMonthlyIncome(userId, month.atDay(1)).orElse(BigDecimal.ZERO);
    }

    private SubscriptionResponse toSubscriptionResponse(List<CategorizedTransaction> payments) {
        String merchant = payments.stream()
                .map(CategorizedTransaction::getMerchant)
                .filter(name -> name != null && !name.isBlank())
                .findFirst()
                .orElse(payments.getFirst().getNormalizedMerchant());
        BigDecimal amount = payments.stream()
                .map(CategorizedTransaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(payments.size()), 2, RoundingMode.HALF_UP);
        TransactionCategory category = payments.stream()
                .map(CategorizedTransaction::getCategory)
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()))
                .entrySet().stream()
                .max(Comparator.comparingLong(Map.Entry::getValue))
                .map(Map.Entry::getKey)
                .orElse(null);
        LocalDate lastPaid = payments.stream()
                .map(transaction -> transaction.getCreatedAt().atZone(ZoneId.of("UTC")).toLocalDate())
                .max(Comparator.naturalOrder())
                .orElse(null);
        return new SubscriptionResponse(merchant, category, amount, "monthly", payments.size(), lastPaid);
    }

    private long distinctMonths(List<CategorizedTransaction> payments) {
        return payments.stream()
                .map(transaction -> YearMonth.from(transaction.getCreatedAt().atZone(ZoneId.of("UTC"))))
                .distinct()
                .count();
    }

    private Map<TransactionCategory, BigDecimal> totalsByCategory(UUID userId, ReportRange range) {
        Instant from = range.from().atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to = range.to().plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        Map<TransactionCategory, BigDecimal> totals = new HashMap<>();
        addCategorySums(totals, categorizedTransactionRepository.sumByCategoryAndTypeBetween(
                userId, "DEBIT", TransactionCategory.BUDGET, from, to));
        Map<TransactionCategory, BigDecimal> credits = new HashMap<>();
        addCategorySums(credits, categorizedTransactionRepository.sumByCategoryAndTypeBetween(
                userId, "CREDIT", TransactionCategory.BUDGET, from, to));
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

    private BigDecimal netExpenses(UUID userId, ReportRange range) {
        BigDecimal debits = sumByType(userId, range, "DEBIT");
        BigDecimal credits = sumByType(userId, range, "CREDIT");
        return debits.subtract(credits).max(BigDecimal.ZERO);
    }

    private BigDecimal sumByType(UUID userId, ReportRange range, String transactionType) {
        return categorizedTransactionRepository.sumAmountByUserAndTypeAndPeriod(userId, transactionType,
                range.from().atStartOfDay(ZoneOffset.UTC).toInstant(),
                range.to().plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant());
    }

    private ReportRange currentRange(ReportPeriod period, LocalDate at) {
        return switch (period) {
            case WEEKLY -> ReportRange.weekOf(YearMonth.from(at), weekBucket(at.getDayOfMonth()));
            case MONTHLY -> ReportRange.of(YearMonth.from(at));
            case YEARLY -> ReportRange.ofYear(at.getYear());
        };
    }

    private ReportRange previousRange(ReportPeriod period, LocalDate at) {
        return switch (period) {
            case WEEKLY -> ReportRange.weekOf(YearMonth.from(at).minusMonths(1), weekBucket(at.getDayOfMonth()));
            case MONTHLY -> ReportRange.of(YearMonth.from(at).minusMonths(1));
            case YEARLY -> ReportRange.ofYear(at.getYear() - 1);
        };
    }

    private static int weeksInMonth(YearMonth month) {
        return (month.lengthOfMonth() + 6) / 7;
    }

    private static int weekBucket(int dayOfMonth) {
        return (dayOfMonth - 1) / 7;
    }

    private static String rupees(BigDecimal amount) {
        return RUPEE_FORMAT.format(amount);
    }

    private static String prettyCategory(TransactionCategory category) {
        String name = category.name().toLowerCase(Locale.ROOT).replace('_', ' ');
        return name.substring(0, 1).toUpperCase(Locale.ROOT) + name.substring(1);
    }

    private int changePercent(BigDecimal currentAmount, BigDecimal previousAmount) {
        if (previousAmount.signum() == 0) {
            return currentAmount.signum() > 0 ? 100 : 0;
        }
        return currentAmount.subtract(previousAmount)
                .multiply(HUNDRED)
                .divide(previousAmount, 0, RoundingMode.HALF_UP)
                .intValue();
    }
}