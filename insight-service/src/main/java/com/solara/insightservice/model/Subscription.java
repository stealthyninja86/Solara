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
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "subscriptions")
public class Subscription {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 200)
    private String merchant;

    @Column(name = "normalized_merchant", nullable = false, length = 200)
    private String normalizedMerchant;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SubscriptionFrequency frequency;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "next_expected_date", nullable = false)
    private LocalDate nextExpectedDate;

    @Column(name = "last_charge_date")
    private LocalDate lastChargeDate;

    @Column(name = "last_charge_amount", precision = 12, scale = 2)
    private BigDecimal lastChargeAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SubscriptionKind kind = SubscriptionKind.SUBSCRIPTION;

    @Column(name = "amount_tolerance_percent")
    private Integer amountTolerancePercent;

    @Column(name = "tenure_months")
    private Integer tenureMonths;

    @Column(name = "paid_months")
    private Integer paidMonths = 0;

    @Column(name = "payee_merchant", length = 200)
    private String payeeMerchant;

    @Column(name = "last_charge_transaction_id")
    private UUID lastChargeTransactionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SubscriptionStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Subscription() {}

    public Subscription(UUID id, UUID userId, String merchant, String normalizedMerchant,
                        SubscriptionFrequency frequency, BigDecimal amount, LocalDate nextExpectedDate) {
        this.id = id;
        this.userId = userId;
        this.merchant = merchant;
        this.normalizedMerchant = normalizedMerchant;
        this.frequency = frequency;
        this.amount = amount;
        this.nextExpectedDate = nextExpectedDate;
        this.status = SubscriptionStatus.ACTIVE;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getMerchant() { return merchant; }
    public void setMerchant(String merchant) { this.merchant = merchant; }

    public String getNormalizedMerchant() { return normalizedMerchant; }
    public void setNormalizedMerchant(String normalizedMerchant) { this.normalizedMerchant = normalizedMerchant; }

    public SubscriptionFrequency getFrequency() { return frequency; }
    public void setFrequency(SubscriptionFrequency frequency) { this.frequency = frequency; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public LocalDate getNextExpectedDate() { return nextExpectedDate; }
    public void setNextExpectedDate(LocalDate nextExpectedDate) { this.nextExpectedDate = nextExpectedDate; }

    public LocalDate getLastChargeDate() { return lastChargeDate; }
    public void setLastChargeDate(LocalDate lastChargeDate) { this.lastChargeDate = lastChargeDate; }

    public BigDecimal getLastChargeAmount() { return lastChargeAmount; }
    public void setLastChargeAmount(BigDecimal lastChargeAmount) { this.lastChargeAmount = lastChargeAmount; }

    public SubscriptionKind getKind() { return kind; }
    public void setKind(SubscriptionKind kind) { this.kind = kind; }

    public Integer getAmountTolerancePercent() { return amountTolerancePercent; }
    public void setAmountTolerancePercent(Integer amountTolerancePercent) { this.amountTolerancePercent = amountTolerancePercent; }

    public Integer getTenureMonths() { return tenureMonths; }
    public void setTenureMonths(Integer tenureMonths) { this.tenureMonths = tenureMonths; }

    public Integer getPaidMonths() { return paidMonths; }
    public void setPaidMonths(Integer paidMonths) { this.paidMonths = paidMonths; }

    public String getPayeeMerchant() { return payeeMerchant; }
    public void setPayeeMerchant(String payeeMerchant) { this.payeeMerchant = payeeMerchant; }

    public UUID getLastChargeTransactionId() { return lastChargeTransactionId; }
    public void setLastChargeTransactionId(UUID lastChargeTransactionId) { this.lastChargeTransactionId = lastChargeTransactionId; }

    public SubscriptionStatus getStatus() { return status; }
    public void setStatus(SubscriptionStatus status) { this.status = status; }

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
}