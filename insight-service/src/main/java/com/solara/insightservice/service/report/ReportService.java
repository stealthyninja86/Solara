package com.solara.insightservice.service.report;

import com.solara.insightservice.dto.response.ReportCategorySpending;
import com.solara.insightservice.dto.response.ReportRange;
import com.solara.insightservice.dto.response.ReportResponse;
import com.solara.insightservice.dto.response.ReportSummary;
import com.solara.insightservice.dto.response.ReportTrendPoint;
import com.solara.insightservice.dto.response.SolaraInsightResponse;
import com.solara.insightservice.dto.response.InsightFact;
import com.solara.insightservice.model.InsightType;
import com.solara.insightservice.model.ReportPeriod;
import com.solara.insightservice.model.TransactionCategory;
import com.solara.insightservice.repository.CategorizedTransactionRepository;
import com.solara.insightservice.service.finance.FinanceQueryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Optional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

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

    private static final List<TransactionCategory> EXPENSE_EXCLUDED =
            List.of(TransactionCategory.INVESTMENT);

    private static final List<TransactionCategory> CATEGORY_SUM_EXCLUDED =
            List.of(TransactionCategory.BUDGET, TransactionCategory.INVESTMENT);

    private static final List<TransactionCategory> INVESTMENT_ONLY_EXCLUDED =
            Arrays.stream(TransactionCategory.values())
                    .filter(category -> category != TransactionCategory.INVESTMENT)
                    .toList();

    private final CategorizedTransactionRepository categorizedTransactionRepository;
    private final FinanceQueryService financeQueryService;

    public ReportService(CategorizedTransactionRepository categorizedTransactionRepository,
                         FinanceQueryService financeQueryService) {
        this.categorizedTransactionRepository = categorizedTransactionRepository;
        this.financeQueryService = financeQueryService;
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
            case DAILY -> "day";
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
                    InsightType.STATUS,
                    "your savings left after spending, with your income alongside for comparison"));
        }
        if (summary.income().signum() > 0) {
            BigDecimal invested = investedThisPeriod(userId, report);
            if (invested.signum() > 0) {
                facts.add(new InsightFact("investment_amount", "Invested amount",
                        rupees(invested), null, null,
                        InsightType.STATUS,
                        "the amount moved into investments this period; encourage consistent investing as a healthy habit, never advise selling or stopping investments"));
            }
        }
        // Budget left — the number every persona checks first (housewife / salaried / student)
        // Value = rupees left, previous = percent used. Keep language in rupees + days, not just %.
        createBudgetStatusFact(userId, period, report, summary).ifPresent(facts::add);
        // Upcoming recurring — bills/EMI/rent due later this month, already reserved from budget
        createUpcomingRecurringFact(userId, period, report).ifPresent(facts::add);
        // Budget action — actionable tip for recommendations when budget is tight
        createBudgetActionFact(userId, period, report, summary).ifPresent(facts::add);
        createUpcomingActionFact(userId, period, report).ifPresent(facts::add);
        // Only meaningful with income set: with income 0/unset, savings is
        // always negative and "spending exceeded income" is a false alarm.
        if (summary.income().signum() > 0 && summary.expenses().signum() > 0 && summary.savings().signum() < 0) {
            facts.add(new InsightFact("over_budget", "Spending exceeded income",
                    rupees(summary.savings().abs()), rupees(summary.income()), null,
                    InsightType.ACTION,
                    "how much more was spent than was earned, with the income alongside for comparison; there is no change value; "
                    + "say plainly you are over by that amount and give one tiny household tip to get back on track (e.g., pause a non-essential subscription, cook at home); "
                    + "keep it to one plain sentence a housewife, salaried employee or student would understand"));
        }
        if (!categories.isEmpty() && summary.expenses().signum() > 0) {
            ReportCategorySpending top = categories.getFirst();
            BigDecimal share = top.amount().multiply(HUNDRED)
                    .divide(summary.expenses(), 0, RoundingMode.HALF_UP);
            if (share.compareTo(TWENTY_FIVE) >= 0) {
                // Same-unit comparison: the previous value is last period's
                // SHARE of the same category (not its amount — mixing a share
                // with an amount produced "up by 3376%" nonsense), and the
                // change is the share movement in percentage points.
                String previousShareValue = null;
                String shareChange = null;
                String previousShareHint = "";
                String changeHint = "";
                ReportRange previousRange = previousRange(period, report.from());
                ReportSummary previousSummary = buildSummary(userId, period, previousRange);
                if (previousSummary.expenses().signum() > 0) {
                    BigDecimal previousCategoryAmount = totalsByCategory(userId, previousRange)
                            .getOrDefault(top.category(), BigDecimal.ZERO);
                    if (previousCategoryAmount.signum() > 0) {
                        BigDecimal previousShare = previousCategoryAmount.multiply(HUNDRED)
                                .divide(previousSummary.expenses(), 0, RoundingMode.HALF_UP);
                        previousShareValue = previousShare + "% of spending";
                        shareChange = Integer.toString(share.subtract(previousShare).intValue());
                        previousShareHint = "the previous value is last period's share of the same category; ";
                        changeHint = "the change value is how that share moved, in percentage points; ";
                    }
                }
                facts.add(new InsightFact("top_category_share",
                        prettyCategory(top.category()),
                        share + "% of spending", previousShareValue,
                        shareChange, InsightType.ACTION,
                        "the fact label is the NAME of the largest spending category — always use that exact name in the body (for example write it as \"your " + prettyCategory(top.category()).toLowerCase() + " spending\"); the value is the share of this period's total spending that went to that category; " + previousShareHint + changeHint
                        + "this is a concentration — give one tiny, household-friendly tip to spread it (e.g., if Food, cook at home twice this week; if Shopping, delay one small purchase); never advise spending more; keep it plain"));
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
                        delta.toString(), InsightType.NEXT,
                        "your total spending this period, with last period's total alongside; the change value is the percentage change between them"));
            }
            if (delta.abs().compareTo(FIFTEEN) >= 0) {
                facts.add(new InsightFact("spending_vs_previous", "Spending vs previous period",
                        rupees(summary.expenses()), rupees(previous.expenses()),
                        delta.toString(), InsightType.ACTION,
                        "how this period's total spending compares to the previous period's total; the previous value is the previous period's total and the change value is the percentage change between them; the change is POSITIVE when spending rose and NEGATIVE when it fell — never invert the sign; say plainly whether spending rose or fell and by how much in rupees; if it rose, give one tiny household tip to bring it down (e.g., cook at home, pause a subscription); if it fell, briefly praise the improvement in one plain sentence a housewife, salaried employee or student would understand"));
            }
        }
        return facts;
    }

    private ReportSummary buildSummary(UUID userId, ReportPeriod period, ReportRange current) {
        BigDecimal income = switch (period) {
            case DAILY -> {
                YearMonth month = YearMonth.from(current.from());
                BigDecimal monthIncome = monthlyIncome(userId, month);
                yield monthIncome.divide(BigDecimal.valueOf(month.lengthOfMonth()), 2, RoundingMode.HALF_UP);
            }
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
            case DAILY -> {
                YearMonth month = YearMonth.from(at);
                BigDecimal monthIncome = monthlyIncome(userId, month);
                BigDecimal dailyIncome = monthIncome
                        .divide(BigDecimal.valueOf(month.lengthOfMonth()), 2, RoundingMode.HALF_UP);
                ReportRange day = ReportRange.ofDay(at);
                BigDecimal expenses = netExpenses(userId, day);
                points.add(new ReportTrendPoint(String.valueOf(at.getDayOfMonth()), dailyIncome, expenses));
            }
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
        return financeQueryService.getMonthlyIncome(userId, month.atDay(1)).orElse(BigDecimal.ZERO);
    }

    private Map<TransactionCategory, BigDecimal> totalsByCategory(UUID userId, ReportRange range) {
        Instant from = range.from().atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to = range.to().plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        Map<TransactionCategory, BigDecimal> totals = new HashMap<>();
        addCategorySums(totals, categorizedTransactionRepository.sumByCategoryAndTypeBetween(
                userId, "DEBIT", CATEGORY_SUM_EXCLUDED, from, to));
        Map<TransactionCategory, BigDecimal> credits = new HashMap<>();
        addCategorySums(credits, categorizedTransactionRepository.sumByCategoryAndTypeBetween(
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

    private BigDecimal investedThisPeriod(UUID userId, ReportResponse report) {
        Instant from = report.from().atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to = report.to().plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        Map<TransactionCategory, BigDecimal> totals = new HashMap<>();
        addCategorySums(totals, categorizedTransactionRepository.sumByCategoryAndTypeBetween(
                userId, "DEBIT", INVESTMENT_ONLY_EXCLUDED, from, to));
        return totals.getOrDefault(TransactionCategory.INVESTMENT, BigDecimal.ZERO);
    }

    private BigDecimal netExpenses(UUID userId, ReportRange range) {
        BigDecimal debits = sumByType(userId, range, "DEBIT");
        BigDecimal credits = sumByType(userId, range, "CREDIT");
        return debits.subtract(credits).max(BigDecimal.ZERO);
    }

    private BigDecimal sumByType(UUID userId, ReportRange range, String transactionType) {
        return categorizedTransactionRepository.sumAmountByUserAndTypeAndPeriod(userId, transactionType,
                EXPENSE_EXCLUDED,
                range.from().atStartOfDay(ZoneOffset.UTC).toInstant(),
                range.to().plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant());
    }

    private ReportRange currentRange(ReportPeriod period, LocalDate at) {
        return switch (period) {
            case DAILY -> ReportRange.ofDay(at);
            case WEEKLY -> ReportRange.weekOf(YearMonth.from(at), weekBucket(at.getDayOfMonth()));
            case MONTHLY -> ReportRange.of(YearMonth.from(at));
            case YEARLY -> ReportRange.ofYear(at.getYear());
        };
    }

    private ReportRange previousRange(ReportPeriod period, LocalDate at) {
        return switch (period) {
            case DAILY -> ReportRange.ofDay(at.minusDays(1));
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

    private Optional<InsightFact> createBudgetStatusFact(UUID userId, ReportPeriod period,
                                                         ReportResponse report, ReportSummary summary) {
        Optional<BigDecimal> periodBudgetOpt = switch (period) {
            case DAILY -> {
                YearMonth yearMonth = YearMonth.from(report.from());
                Optional<BigDecimal> monthlyOpt = financeQueryService.getMonthlyBudget(userId, yearMonth.atDay(1));
                if (monthlyOpt.isEmpty() || monthlyOpt.get().signum() <= 0) yield Optional.empty();
                BigDecimal dailyBudget = monthlyOpt.get()
                        .divide(BigDecimal.valueOf(yearMonth.lengthOfMonth()), 2, RoundingMode.HALF_UP);
                yield Optional.of(dailyBudget);
            }
            case WEEKLY -> {
                YearMonth yearMonth = YearMonth.from(report.from());
                Optional<BigDecimal> monthlyOpt = financeQueryService.getMonthlyBudget(userId, yearMonth.atDay(1));
                if (monthlyOpt.isEmpty() || monthlyOpt.get().signum() <= 0) yield Optional.empty();
                long daysInRange = ChronoUnit.DAYS.between(report.from(), report.to()) + 1;
                BigDecimal weeklyBudget = monthlyOpt.get()
                        .multiply(BigDecimal.valueOf(daysInRange))
                        .divide(BigDecimal.valueOf(yearMonth.lengthOfMonth()), 2, RoundingMode.HALF_UP);
                yield Optional.of(weeklyBudget);
            }
            case MONTHLY -> financeQueryService.getMonthlyBudget(userId, report.from());
            case YEARLY -> {
                BigDecimal total = BigDecimal.ZERO;
                boolean found = false;
                for (int monthIndex = 1; monthIndex <= 12; monthIndex++) {
                    Optional<BigDecimal> monthlyBudget = financeQueryService.getMonthlyBudget(
                            userId, LocalDate.of(report.from().getYear(), monthIndex, 1));
                    if (monthlyBudget.isPresent() && monthlyBudget.get().signum() > 0) {
                        total = total.add(monthlyBudget.get());
                        found = true;
                    }
                }
                yield found ? Optional.of(total) : Optional.empty();
            }
        };
        if (periodBudgetOpt.isEmpty() || periodBudgetOpt.get().signum() <= 0) return Optional.empty();
        BigDecimal periodBudget = periodBudgetOpt.get();
        BigDecimal spent = summary.expenses();
        BigDecimal left = periodBudget.subtract(spent);
        boolean overBudget = left.signum() < 0;
        String value = rupees(left.abs()) + (overBudget ? " over" : " left");
        int percentUsed = spent.multiply(HUNDRED)
                .divide(periodBudget, 0, RoundingMode.HALF_UP).intValue();
        String previousValue = percentUsed + "% used";
        String change = String.valueOf(percentUsed);
        long daysLeft = ChronoUnit.DAYS.between(LocalDate.now(), report.to()) + 1;
        if (daysLeft < 0) daysLeft = 0;
        String periodWord = periodWord(period);
        String hint = "your budget status this " + periodWord + " — the value is how much budget remains"
                + " (or by how much you are over), the previous value is the percent of the budget already used; "
                + "there are " + daysLeft + " days left in this " + periodWord + "; "
                + "speak in rupees left and days left, not just percent; "
                + (overBudget
                        ? "you are over budget — give one tiny, household-friendly tip to pause a non-essential spend; "
                        : percentUsed >= 75
                                ? "over 75% used — give one tiny tip to stretch the remaining days (e.g., cook at home, delay a small purchase); "
                                : "")
                + "keep it to one plain sentence a housewife, salaried employee or student would understand; "
                + "never mention delta or previous levels";
        return Optional.of(new InsightFact("budget_status", "Budget left",
                value, previousValue, change, InsightType.STATUS, hint));
    }

    private Optional<InsightFact> createUpcomingRecurringFact(UUID userId, ReportPeriod period, ReportResponse report) {
        YearMonth yearMonth = YearMonth.from(report.from());
        BigDecimal upcoming = financeQueryService.upcomingRecurringCosts(userId, yearMonth);
        if (upcoming.signum() <= 0) return Optional.empty();
        String periodWord = periodWord(period);
        String hint = "upcoming recurring charges still due this " + periodWord
                + " (subscriptions, bills, rent or EMI); say the total is already reserved from your budget; "
                + "keep it short and plain; no advice to spend more";
        return Optional.of(new InsightFact("upcoming_recurring", "Upcoming bills",
                rupees(upcoming) + " due", null, null, InsightType.STATUS, hint));
    }

    private Optional<InsightFact> createBudgetActionFact(UUID userId, ReportPeriod period,
                                                         ReportResponse report, ReportSummary summary) {
        Optional<BigDecimal> periodBudgetOpt = switch (period) {
            case DAILY -> {
                YearMonth yearMonth = YearMonth.from(report.from());
                Optional<BigDecimal> monthlyOpt = financeQueryService.getMonthlyBudget(userId, yearMonth.atDay(1));
                if (monthlyOpt.isEmpty() || monthlyOpt.get().signum() <= 0) yield Optional.empty();
                BigDecimal dailyBudget = monthlyOpt.get()
                        .divide(BigDecimal.valueOf(yearMonth.lengthOfMonth()), 2, RoundingMode.HALF_UP);
                yield Optional.of(dailyBudget);
            }
            case WEEKLY -> {
                YearMonth yearMonth = YearMonth.from(report.from());
                Optional<BigDecimal> monthlyOpt = financeQueryService.getMonthlyBudget(userId, yearMonth.atDay(1));
                if (monthlyOpt.isEmpty() || monthlyOpt.get().signum() <= 0) yield Optional.empty();
                long daysInRange = ChronoUnit.DAYS.between(report.from(), report.to()) + 1;
                BigDecimal weeklyBudget = monthlyOpt.get()
                        .multiply(BigDecimal.valueOf(daysInRange))
                        .divide(BigDecimal.valueOf(yearMonth.lengthOfMonth()), 2, RoundingMode.HALF_UP);
                yield Optional.of(weeklyBudget);
            }
            case MONTHLY -> financeQueryService.getMonthlyBudget(userId, report.from());
            case YEARLY -> {
                BigDecimal total = BigDecimal.ZERO;
                boolean found = false;
                for (int monthIndex = 1; monthIndex <= 12; monthIndex++) {
                    Optional<BigDecimal> monthlyBudget = financeQueryService.getMonthlyBudget(
                            userId, LocalDate.of(report.from().getYear(), monthIndex, 1));
                    if (monthlyBudget.isPresent() && monthlyBudget.get().signum() > 0) {
                        total = total.add(monthlyBudget.get());
                        found = true;
                    }
                }
                yield found ? Optional.of(total) : Optional.empty();
            }
        };
        if (periodBudgetOpt.isEmpty() || periodBudgetOpt.get().signum() <= 0) return Optional.empty();
        BigDecimal periodBudget = periodBudgetOpt.get();
        BigDecimal spent = summary.expenses();
        int percentUsed = spent.multiply(HUNDRED)
                .divide(periodBudget, 0, RoundingMode.HALF_UP).intValue();
        boolean overBudget = spent.compareTo(periodBudget) > 0;
        if (!overBudget && percentUsed < 70) return Optional.empty();
        BigDecimal left = periodBudget.subtract(spent);
        String value = rupees(left.abs()) + (overBudget ? " over budget" : " left");
        String previousValue = percentUsed + "% of budget used";
        String change = String.valueOf(percentUsed);
        String periodWord = periodWord(period);
        String hint = "your budget is tight this " + periodWord + " — the value is how much budget remains (or over),"
                + " the previous value is the percent already used; "
                + (overBudget
                        ? "you are over — give one tiny household action to get back on track (e.g., pause a small subscription, cook at home); "
                        : "give one tiny tip to stretch the remaining budget for the rest of the " + periodWord + " (e.g., limit eating out once this week); ")
                + "keep it to one plain sentence a housewife, salaried employee or student would understand";
        return Optional.of(new InsightFact("budget_action", "Budget tip",
                value, previousValue, change, InsightType.ACTION, hint));
    }

    private Optional<InsightFact> createUpcomingActionFact(UUID userId, ReportPeriod period, ReportResponse report) {
        YearMonth yearMonth = YearMonth.from(report.from());
        BigDecimal upcoming = financeQueryService.upcomingRecurringCosts(userId, yearMonth);
        if (upcoming.signum() <= 0) return Optional.empty();
        // Only actionable if upcoming is sizable (>20% of monthly budget or >₹1,000)
        Optional<BigDecimal> budgetOpt = financeQueryService.getMonthlyBudget(userId, report.from());
        boolean sizable = upcoming.compareTo(BigDecimal.valueOf(1000)) > 0
                || (budgetOpt.isPresent() && budgetOpt.get().signum() > 0
                        && upcoming.multiply(HUNDRED).divide(budgetOpt.get(), 0, RoundingMode.HALF_UP).intValue() >= 20);
        if (!sizable) return Optional.empty();
        String periodWord = periodWord(period);
        String hint = "upcoming bills/EMI/rent due this " + periodWord + " that are already reserved; "
                + "the value is the total due; give one plain tip to prepare (e.g., keep that amount untouched, set a reminder); "
                + "no advice to spend more";
        return Optional.of(new InsightFact("upcoming_action", "Upcoming bills tip",
                rupees(upcoming) + " due soon", null, null, InsightType.ACTION, hint));
    }

    private String periodWord(ReportPeriod period) {
        return switch (period) {
            case DAILY -> "day";
            case WEEKLY -> "week";
            case MONTHLY -> "month";
            case YEARLY -> "year";
        };
    }
}