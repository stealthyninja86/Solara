package com.solara.insightservice.dto;

import com.solara.insightservice.model.CategorizedTransaction;
import com.solara.insightservice.model.TransactionCategory;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CategorizedTransactionResponse(
    UUID transactionId,
    UUID userId,
    String merchant,
    String normalizedMerchant,
    String originalDescription,
    BigDecimal amount,
    String currency,
    TransactionCategory category,
    BigDecimal confidence,
    String categorizationMethod,
    String paymentMode,
    String type,
    boolean isSubscription,
    boolean needsReview,
    boolean bulkImport,
    Instant createdAt,
    Instant updatedAt
) {
    public static CategorizedTransactionResponse from(CategorizedTransaction transaction) {
        return new CategorizedTransactionResponse(
            transaction.getTransactionId(), transaction.getUserId(), transaction.getMerchant(),
            transaction.getNormalizedMerchant(), transaction.getOriginalDescription(),
            transaction.getAmount(), transaction.getCurrency(), transaction.getCategory(),
            transaction.getConfidence(), transaction.getCategorizationMethod(),
            transaction.getPaymentMode(), transaction.getType(),
            transaction.isSubscription(), transaction.isNeedsReview(),
            transaction.isBulkImport(),
            transaction.getCreatedAt(), transaction.getUpdatedAt()
        );
    }
}
