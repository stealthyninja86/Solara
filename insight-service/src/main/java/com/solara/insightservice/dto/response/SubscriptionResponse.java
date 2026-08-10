package com.solara.insightservice.dto.response;

import com.solara.insightservice.model.TransactionCategory;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SubscriptionResponse(String merchant,
                                   TransactionCategory category,
                                   BigDecimal amount,
                                   String interval,
                                   int occurrences,
                                   LocalDate lastPaid) {}
