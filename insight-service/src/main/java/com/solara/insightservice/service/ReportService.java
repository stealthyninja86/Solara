package com.solara.insightservice.service;

import com.solara.insightservice.dto.response.ReportCategorySpending;
import com.solara.insightservice.dto.response.ReportResponse;
import com.solara.insightservice.dto.response.ReportSummary;
import com.solara.insightservice.dto.response.ReportTrendPoint;
import com.solara.insightservice.model.Projection;
import com.solara.insightservice.model.ReportPeriod;
import com.solara.insightservice.model.TransactionCategory;
import com.solara.insightservice.repository.ProjectionRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ReportService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final ProjectionRepository projectionRepository;
    private final com.solara.insightservice.repository.CategorizedTransactionRepository categorizedTransactionRepository;

    public ReportService(ProjectionRepository projectionRepository,
                         com.solara.insightservice.repository.CategorizedTransactionRepository categorizedTransactionRepository) {
        this.projectionRepository = projectionRepository;
        this.categorizedTransactionRepository = categorizedTransactionRepository;
    }

    public ReportResponse buildReport(UUID userId, ReportPeriod period, LocalDate at) {
        DateRange current = currentRange(period, at);
        DateRange previous = previousRange(period, at);

        Map<TransactionCategory, BigDecimal> currentTotals = totalsByCategory(userId, projectionPeriod(period), current);
        Map<TransactionCategory, BigDecimal> previousTotals = totalsByCategory(userId, projectionPeriod(period), previous);

        ReportSummary summary = buildSummary(userId, period, current);
        List<ReportCategorySpending> categories = buildCategorySpending(currentTotals, previousTotals);
        List<ReportTrendPoint> trend = buildTrend(userId, period, at);

        return new ReportResponse(userId, period, summary, categories, trend);
    }

    private ReportSummary buildSummary(UUID userId, ReportPeriod period, DateRange current) {
        BigDecimal income = switch (period) {
            case WEEKLY -> {
                LocalDate monthStart = YearMonth.from(current.from()).atDay(1);
                yield projectionRepository.findMonthlyIncome(userId, monthStart).orElse(BigDecimal.ZERO);
            }
            case MONTHLY -> projectionRepository.findMonthlyIncome(userId, current.from()).orElse(BigDecimal.ZERO);
            case YEARLY -> {
                BigDecimal total = BigDecimal.ZERO;
                for (int m = 1; m <= 12; m++) {
                    total = total.add(projectionRepository.findMonthlyIncome(userId,
                            LocalDate.of(current.from().getYear(), m, 1)).orElse(BigDecimal.ZERO));
                }
                yield total;
            }
        };
        BigDecimal expenses = sumByType(userId, projectionPeriod(period), current, "DEBIT");
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
                LocalDate weekStart = at.with(java.time.DayOfWeek.MONDAY);
                YearMonth ym = YearMonth.from(at);
                BigDecimal monthIncome = projectionRepository.findMonthlyIncome(userId,
                        ym.atDay(1)).orElse(BigDecimal.ZERO);
                BigDecimal dailyIncome = ym.lengthOfMonth() > 0
                        ? monthIncome.divide(BigDecimal.valueOf(ym.lengthOfMonth()), 2, RoundingMode.HALF_UP)
                        : BigDecimal.ZERO;
                String[] dayLabels = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"};
                java.time.Instant[] dayStarts = new java.time.Instant[7];
                java.time.Instant[] dayEnds = new java.time.Instant[7];
                for (int i = 0; i < 7; i++) {
                    LocalDate day = weekStart.plusDays(i);
                    dayStarts[i] = day.atStartOfDay(java.time.ZoneOffset.UTC).toInstant();
                    dayEnds[i] = day.plusDays(1).atStartOfDay(java.time.ZoneOffset.UTC).toInstant();
                }
                for (int i = 0; i < 7; i++) {
                    BigDecimal expenses = categorizedTransactionRepository
                            .sumAmountByUserAndTypeAndPeriod(userId, "DEBIT", dayStarts[i], dayEnds[i]);
                    points.add(new ReportTrendPoint(dayLabels[i], dailyIncome, expenses));
                }
            }
            case MONTHLY -> {
                LocalDate weekStart = at.with(java.time.DayOfWeek.MONDAY);
                BigDecimal monthIncome = projectionRepository.findMonthlyIncome(userId,
                        YearMonth.from(at).atDay(1)).orElse(BigDecimal.ZERO);
                for (int w = 0; w < 4; w++) {
                    LocalDate wFrom = weekStart.plusDays(w * 7L);
                    LocalDate wTo = wFrom.plusDays(6);
                    DateRange range = DateRange.ofDay(wFrom, wTo);
                    points.add(trendPoint(userId, "WEEKLY", range, monthIncome,
                            String.format(Locale.ROOT, "W%d", w + 1)));
                }
            }
            case YEARLY -> {
                int year = at.getYear();
                String[] monthLabels = {"Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
                for (int m = 0; m < 12; m++) {
                    YearMonth bucketMonth = YearMonth.of(year, m + 1);
                    LocalDate bucketMonthStart = bucketMonth.atDay(1);
                    BigDecimal monthIncome = projectionRepository.findMonthlyIncome(userId,
                            bucketMonthStart).orElse(BigDecimal.ZERO);
                    points.add(trendPoint(userId, "MONTHLY", DateRange.of(bucketMonth), monthIncome,
                            monthLabels[m]));
                }
            }
        }
        return points;
    }

    private ReportTrendPoint trendPoint(UUID userId, String projectionPeriod, DateRange range,
                                         BigDecimal income, String label) {
        BigDecimal expenses = sumByType(userId, projectionPeriod, range, "DEBIT");
        return new ReportTrendPoint(label, income, expenses);
    }

    private Map<TransactionCategory, BigDecimal> totalsByCategory(UUID userId, String projectionPeriod, DateRange range) {
        return projectionRepository.findByUserIdAndPeriodAndPeriodStartBetween(userId, projectionPeriod, range.from(), range.to())
                .stream()
                .filter(projection -> "DEBIT".equals(projection.getTransactionType()))
                .filter(projection -> TransactionCategory.BUDGET != projection.getCategory())
                .collect(Collectors.groupingBy(Projection::getCategory,
                        Collectors.reducing(BigDecimal.ZERO, Projection::getTotalAmount, BigDecimal::add)));
    }

    private BigDecimal sumByType(UUID userId, String projectionPeriod, DateRange range, String transactionType) {
        return projectionRepository.findByUserIdAndPeriodAndPeriodStartBetween(userId, projectionPeriod, range.from(), range.to())
                .stream()
                .filter(projection -> transactionType.equals(projection.getTransactionType()))
                .map(Projection::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String projectionPeriod(ReportPeriod period) {
        return switch (period) {
            case WEEKLY -> "WEEKLY";
            case MONTHLY, YEARLY -> "MONTHLY";
        };
    }

    private DateRange currentRange(ReportPeriod period, LocalDate at) {
        return switch (period) {
            case WEEKLY -> DateRange.ofDay(weekStart(at));
            case MONTHLY -> DateRange.of(YearMonth.from(at));
            case YEARLY -> DateRange.ofYear(at.getYear());
        };
    }

    private DateRange previousRange(ReportPeriod period, LocalDate at) {
        return switch (period) {
            case WEEKLY -> DateRange.ofDay(weekStart(weekStart(at).minusDays(7)));
            case MONTHLY -> DateRange.of(YearMonth.from(at).minusMonths(1));
            case YEARLY -> DateRange.ofYear(at.getYear() - 1);
        };
    }

    private LocalDate weekStart(LocalDate date) {
        return YearMonth.from(date).atDay(1).plusDays(weekBucket(date.getDayOfMonth()) * 7L);
    }

    private int weekBucket(int dayOfMonth) {
        if (dayOfMonth <= 7) return 0;
        if (dayOfMonth <= 14) return 1;
        if (dayOfMonth <= 21) return 2;
        return 3;
    }

    private DateRange weekRange(LocalDate monthStart, int bucket) {
        return DateRange.ofDay(monthStart.plusDays(bucket * 7L));
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

    private record DateRange(LocalDate from, LocalDate to) {
        static DateRange of(YearMonth month) {
            return new DateRange(month.atDay(1), month.atEndOfMonth());
        }

        static DateRange ofYear(int year) {
            return new DateRange(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));
        }

        static DateRange ofDay(LocalDate day) {
            return new DateRange(day, day);
        }

        static DateRange ofDay(LocalDate from, LocalDate to) {
            return new DateRange(from, to);
        }
    }
}
