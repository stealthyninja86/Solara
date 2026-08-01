package com.solara.insightservice.dto.response;

import com.solara.insightservice.model.TransactionCategory;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

public record TrendsResponse(
    UUID userId,
    LocalDate from,
    LocalDate to,
    Map<TransactionCategory, BigDecimal> categories
) {}
