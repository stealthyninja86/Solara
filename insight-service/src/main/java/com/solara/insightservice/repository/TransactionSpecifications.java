package com.solara.insightservice.repository;

import com.solara.insightservice.model.CategorizedTransaction;
import com.solara.insightservice.model.TransactionCategory;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public class TransactionSpecifications {

    public static Specification<CategorizedTransaction> forUser(UUID userId) {
        return (root, query, cb) -> cb.equal(root.get("userId"), userId);
    }

    public static Specification<CategorizedTransaction> needsReview() {
        return (root, query, cb) -> cb.equal(root.get("needsReview"), true);
    }

    public static Specification<CategorizedTransaction> uncategorized() {
        return (root, query, cb) -> cb.and(
                cb.or(
                        cb.isNull(root.get("category")),
                        cb.equal(root.get("category"), TransactionCategory.UNCATEGORIZED)
                ),
                cb.equal(root.get("agentFailed"), false),
                cb.lessThan(root.get("agentAttempts"), 3)
        );
    }

    public static Specification<CategorizedTransaction> hasCategory(String category) {
        return (root, query, cb) -> {
            if (category == null || category.isBlank()) return null;
            return cb.equal(root.get("category"), category);
        };
    }

    public static Specification<CategorizedTransaction> createdBetween(Instant from, Instant to) {
        return (root, query, cb) -> {
            Predicate predicate = null;
            if (from != null) {
                predicate = cb.greaterThanOrEqualTo(root.get("createdAt"), from);
            }
            if (to != null) {
                Predicate toPredicate = cb.lessThan(root.get("createdAt"), to);
                predicate = predicate != null ? cb.and(predicate, toPredicate) : toPredicate;
            }
            return predicate;
        };
    }

    public static Specification<CategorizedTransaction> updatedBetween(Instant from, Instant to) {
        return (root, query, cb) -> {
            Predicate predicate = null;
            if (from != null) {
                predicate = cb.greaterThanOrEqualTo(root.get("updatedAt"), from);
            }
            if (to != null) {
                Predicate toPredicate = cb.lessThan(root.get("updatedAt"), to);
                predicate = predicate != null ? cb.and(predicate, toPredicate) : toPredicate;
            }
            return predicate;
        };
    }

    public static Specification<CategorizedTransaction> hasPaymentMode(String paymentMode) {
        return (root, query, cb) -> {
            if (paymentMode == null || paymentMode.isBlank()) return null;
            return cb.equal(root.get("paymentMode"), paymentMode);
        };
    }

    public static Specification<CategorizedTransaction> amountBetween(BigDecimal min, BigDecimal max) {
        return (root, query, cb) -> {
            Predicate predicate = null;
            if (min != null) {
                predicate = cb.greaterThanOrEqualTo(root.get("amount"), min);
            }
            if (max != null) {
                Predicate maxPred = cb.lessThanOrEqualTo(root.get("amount"), max);
                predicate = predicate != null ? cb.and(predicate, maxPred) : maxPred;
            }
            return predicate;
        };
    }

    public static Specification<CategorizedTransaction> isBulkImport(boolean bulkImport) {
        return (root, query, cb) -> cb.equal(root.get("bulkImport"), bulkImport);
    }
}
