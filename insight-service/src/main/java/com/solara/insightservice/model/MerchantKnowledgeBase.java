package com.solara.insightservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "merchant_knowledge_base")
public class MerchantKnowledgeBase {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String alias;

    @Column(name = "canonical_name", nullable = false)
    private String canonicalName;

    @Column(nullable = false, length = 50)
    private String category;

    @Column(precision = 3, scale = 2)
    private BigDecimal confidence;

    @Column(name = "transaction_count")
    private Long transactionCount;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public MerchantKnowledgeBase() {}

    public MerchantKnowledgeBase(String alias, String canonicalName, String category,
                                 BigDecimal confidence, long transactionCount) {
        this.alias = alias;
        this.canonicalName = canonicalName;
        this.category = category;
        this.confidence = confidence;
        this.transactionCount = transactionCount;
    }

    @PrePersist
    void prePersist() {
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getAlias() { return alias; }
    public String getCanonicalName() { return canonicalName; }
    public String getCategory() { return category; }
    public BigDecimal getConfidence() { return confidence; }
    public Long getTransactionCount() { return transactionCount; }
    public Instant getCreatedAt() { return createdAt; }
}
