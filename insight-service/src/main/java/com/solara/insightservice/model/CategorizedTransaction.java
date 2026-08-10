package com.solara.insightservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "categorized_transactions")
public class CategorizedTransaction {

    @Id
    @Column(name = "transaction_id")
    private UUID transactionId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 200)
    private String merchant;

    @Column(name = "normalized_merchant", length = 200)
    private String normalizedMerchant;

    @Column(name = "original_description", length = 500)
    private String originalDescription;

    @Column(length = 500)
    private String description;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(length = 3, nullable = false)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(length = 50)
    private TransactionCategory category;

    @Column(precision = 5, scale = 4)
    private BigDecimal confidence;

    @Column(name = "categorization_method", length = 20)
    private String categorizationMethod;

    @Column(name = "payment_mode", length = 20)
    private String paymentMode;

    @Column(length = 10)
    private String type;

    @Column(name = "is_subscription", nullable = false)
    private boolean isSubscription;

    @Column(name = "needs_review", nullable = false)
    private boolean needsReview;

    @Column(name = "agent_attempts", nullable = false)
    private int agentAttempts;

    @Column(name = "agent_failed", nullable = false)
    private boolean agentFailed;

    @Column(name = "bulk_import", nullable = false)
    private boolean bulkImport;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public CategorizedTransaction() {}

    public CategorizedTransaction(UUID transactionId, UUID userId, String merchant,
                                  String originalDescription, BigDecimal amount, String currency) {
        this.transactionId = transactionId;
        this.userId = userId;
        this.merchant = merchant;
        this.normalizedMerchant = normalizeMerchant(merchant);
        this.originalDescription = originalDescription;
        this.amount = amount;
        this.currency = currency;
        this.category = null;
        this.confidence = null;
        this.categorizationMethod = null;
        this.isSubscription = false;
        this.needsReview = false;
        this.agentAttempts = 0;
        this.agentFailed = false;
        this.bulkImport = false;
    }

    public UUID getTransactionId() { return transactionId; }
    public void setTransactionId(UUID transactionId) { this.transactionId = transactionId; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getMerchant() { return merchant; }
    public void setMerchant(String merchant) {
        this.merchant = merchant;
        this.normalizedMerchant = normalizeMerchant(merchant);
    }

    public String getNormalizedMerchant() { return normalizedMerchant; }
    public void setNormalizedMerchant(String normalizedMerchant) { this.normalizedMerchant = normalizedMerchant; }

    public String getOriginalDescription() { return originalDescription; }
    public void setOriginalDescription(String originalDescription) { this.originalDescription = originalDescription; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public TransactionCategory getCategory() { return category; }
    public void setCategory(TransactionCategory category) { this.category = category; }

    public BigDecimal getConfidence() { return confidence; }
    public void setConfidence(BigDecimal confidence) { this.confidence = confidence; }

    public String getCategorizationMethod() { return categorizationMethod; }
    public void setCategorizationMethod(String categorizationMethod) { this.categorizationMethod = categorizationMethod; }

    public String getPaymentMode() { return paymentMode; }
    public void setPaymentMode(String paymentMode) { this.paymentMode = paymentMode; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public boolean isSubscription() { return isSubscription; }
    public void setSubscription(boolean subscription) { isSubscription = subscription; }

    public boolean isNeedsReview() { return needsReview; }
    public void setNeedsReview(boolean needsReview) { this.needsReview = needsReview; }

    public int getAgentAttempts() { return agentAttempts; }
    public void setAgentAttempts(int agentAttempts) { this.agentAttempts = agentAttempts; }

    public boolean isAgentFailed() { return agentFailed; }
    public void setAgentFailed(boolean agentFailed) { this.agentFailed = agentFailed; }

    public boolean isBulkImport() { return bulkImport; }
    public void setBulkImport(boolean bulkImport) { this.bulkImport = bulkImport; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (this.createdAt == null) this.createdAt = now;
        if (this.updatedAt == null) this.updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        this.updatedAt = Instant.now();
    }

    public static String normalizeMerchant(String merchant) {
        if (merchant == null) return null;
        return merchant.toLowerCase().trim();
    }
}
