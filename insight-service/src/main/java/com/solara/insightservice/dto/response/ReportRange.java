package com.solara.insightservice.dto.response;

import java.time.LocalDate;
import java.time.YearMonth;

public record ReportRange(LocalDate from, LocalDate to) {

    public static ReportRange ofDay(LocalDate day) {
        return new ReportRange(day, day);
    }

    public static ReportRange of(YearMonth month) {
        return new ReportRange(month.atDay(1), month.atEndOfMonth());
    }

    public static ReportRange ofYear(int year) {
        return new ReportRange(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));
    }

    public static ReportRange weekOf(YearMonth month, int bucket) {
        LocalDate start = month.atDay(1).plusDays(bucket * 7L);
        LocalDate end = start.plusDays(6);
        LocalDate monthEnd = month.atEndOfMonth();
        if (end.isAfter(monthEnd)) {
            end = monthEnd;
        }
        return new ReportRange(start, end);
    }
}
