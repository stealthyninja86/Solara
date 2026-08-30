package com.solara.insightservice.model;

import java.time.LocalDate;
import java.time.YearMonth;

public enum ReportPeriod {
    DAILY,
    WEEKLY,
    MONTHLY,
    YEARLY;

    public DateRange toDateRange(LocalDate at) {
        LocalDate anchor = at != null ? at : LocalDate.now();
        return switch (this) {
            case DAILY -> new DateRange(anchor, anchor.plusDays(1));
            case WEEKLY -> new DateRange(anchor.with(java.time.DayOfWeek.MONDAY),
                    anchor.with(java.time.DayOfWeek.MONDAY).plusWeeks(1));
            case MONTHLY -> {
                YearMonth ym = YearMonth.from(anchor);
                yield new DateRange(ym.atDay(1), ym.plusMonths(1).atDay(1));
            }
            case YEARLY -> {
                YearMonth ym = YearMonth.from(anchor);
                yield new DateRange(ym.withMonth(1).atDay(1), ym.withMonth(1).plusYears(1).atDay(1));
            }
        };
    }

    public record DateRange(LocalDate from, LocalDate to) {}
}
