package com.solara.insightservice.model;

import java.time.Period;

public enum SubscriptionFrequency {
    DAILY(1, Period.ofDays(1)),
    WEEKLY(2, Period.ofDays(7)),
    MONTHLY(5, Period.ofMonths(1)),
    YEARLY(14, Period.ofYears(1));

    private final int graceDays;
    private final Period period;

    SubscriptionFrequency(int graceDays, Period period) {
        this.graceDays = graceDays;
        this.period = period;
    }

    public int getGraceDays() {
        return graceDays;
    }

    public Period getPeriod() {
        return period;
    }
}
