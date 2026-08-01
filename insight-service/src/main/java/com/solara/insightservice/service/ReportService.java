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
    private static final int WEEKLY_BUCKETS = 4;
    private static final int MONTHLY_BUCKETS = 6;
    private static final int YEARLY_BUCKETS = 5;

    private final ProjectionRepository projectionRepository;

    public ReportService(ProjectionRepository projectionRepository) {
        this.projectionRepository = projectionRepository;
    }

    public ReportResponse buildReport(UUID userId, ReportPeriod period, LocalDate at) {
        DateRange current = currentRange(period, at);
        DateRange previous = previousRange(period, at);

        Map<TransactionCategory, BigDecimal> currentTotals = totalsByCategory(userId, projectionPeriod(period), current);
        Map<TransactionCategory, BigDecimal> previousTotals = totalsByCategory(userId, projectionPeriod(period), previous);

        ReportSummary summary = buildSummary(userId, projectionPeriod(period), current);
        List<ReportCategorySpending> categories = buildCategorySpending(currentTotals, previousTotals);
        List<ReportTrendPoint> trend = buildTrend(userId, period, at);

        return new ReportResponse(userId, period, summary, categories, trend);
    }

    private ReportSummary buildSummary(UUID userId, String projectionPeriod, DateRange current) {
        BigDecimal income = sumByType(userId, projectionPeriod, current, "CREDIT");
        BigDecimal expenses = sumByType(userId, projectionPeriod, current, "DEBIT");
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
                LocalDate monthStart = YearMonth.from(at).atDay(1);
                for (int bucket = 0; bucket < WEEKLY_BUCKETS; bucket++) {
                    DateRange range = weekRange(monthStart, bucket);
                    points.add(trendPoint(userId, "WEEKLY", range,
                            String.format(Locale.ROOT, "W%d", bucket + 1)));
                }
            }
            case MONTHLY -> {
                YearMonth anchor = YearMonth.from(at);
                for (int bucket = MONTHLY_BUCKETS - 1; bucket >= 0; bucket--) {
                    YearMonth bucketMonth = anchor.minusMonths(bucket);
                    points.add(trendPoint(userId, "MONTHLY", DateRange.of(bucketMonth),
                            bucketMonth.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH)));
                }
            }
            case YEARLY -> {
                int anchorYear = at.getYear();
                for (int bucket = YEARLY_BUCKETS - 1; bucket >= 0; bucket--) {
                    int year = anchorYear - bucket;
                    points.add(trendPoint(userId, "MONTHLY", DateRange.ofYear(year),
                            Integer.toString(year)));
                }
            }
        }
        return points;
    }

    private ReportTrendPoint trendPoint(UUID userId, String projectionPeriod, DateRange range, String label) {
        BigDecimal income = sumByType(userId, projectionPeriod, range, "CREDIT");
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
    }
}
