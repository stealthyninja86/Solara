package com.solara.transactionservice.model;

import com.solara.transactionservice.dto.request.UpdateTransactionRequest;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "transactions")
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(length = 500)
    private String description;

    @Column(nullable = false, length = 200)
    private String merchant;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_mode", nullable = false, length = 20)
    private PaymentMode paymentMode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TransactionType type;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(nullable = false)
    private Instant timestamp;

    @Column(name = "bulk_import", nullable = false)
    private boolean bulkImport;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Transaction() {}

    public Transaction(UUID userId, BigDecimal amount, String description,
                       String merchant, PaymentMode paymentMode, TransactionType type) {
        this(userId, amount, description, merchant, paymentMode, type, false);
    }

    public Transaction(UUID userId, BigDecimal amount, String description,
                       String merchant, PaymentMode paymentMode, TransactionType type,
                       boolean isBulkImport) {
        this.userId = userId;
        this.amount = amount;
        this.description = description;
        this.merchant = merchant;
        this.paymentMode = paymentMode;
        this.type = type;
        this.currency = "INR";
        this.timestamp = Instant.now();
        this.bulkImport = isBulkImport;
    }

    public void applyPartialUpdate(UpdateTransactionRequest request) {
        if (request.amount() != null) this.amount = request.amount();
        if (request.description() != null) this.description = request.description();
        if (request.merchant() != null) this.merchant = request.merchant();
        if (request.paymentMode() != null) this.paymentMode = request.paymentMode();
    }

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    public boolean isBulkImport() { return bulkImport; }
    public void setBulkImport(boolean bulkImport) { this.bulkImport = bulkImport; }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getMerchant() {
        return merchant;
    }

    public void setMerchant(String merchant) {
        this.merchant = merchant;
    }

    public PaymentMode getPaymentMode() {
        return paymentMode;
    }

    public void setPaymentMode(PaymentMode paymentMode) {
        this.paymentMode = paymentMode;
    }

    public TransactionType getType() {
        return type;
    }

    public void setType(TransactionType type) {
        this.type = type;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
