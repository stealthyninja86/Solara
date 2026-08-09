package com.solara.insightservice.dto.response;

import com.solara.insightservice.model.SubscriptionFrequency;
import com.solara.insightservice.model.SubscriptionKind;
import com.solara.insightservice.model.SubscriptionStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record TrackedSubscriptionResponse(
        UUID id,
        String merchant,
        SubscriptionFrequency frequency,
        BigDecimal amount,
        LocalDate nextExpectedDate,
        LocalDate lastChargeDate,
        BigDecimal lastChargeAmount,
        SubscriptionKind kind,
        Integer amountTolerancePercent,
        Integer tenureMonths,
        Integer paidMonths,
        String payeeMerchant,
        SubscriptionStatus status,
        String cycleState) {}