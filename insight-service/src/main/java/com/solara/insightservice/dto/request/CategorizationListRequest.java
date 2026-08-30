package com.solara.insightservice.dto.request;

import org.springframework.format.annotation.DateTimeFormat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record CategorizationListRequest(
        UUID userId,
        Boolean needsReview,
        String category,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        LocalDate dateFrom,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        LocalDate dateTo,
        String paymentMode,
        BigDecimal amountMin,
        BigDecimal amountMax,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        LocalDate updatedAtFrom,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        LocalDate updatedAtTo,
        Boolean bulkImport
) {
}
