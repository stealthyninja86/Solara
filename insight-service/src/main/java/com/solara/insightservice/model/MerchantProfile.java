package com.solara.insightservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "merchant_profiles", uniqueConstraints = {
        @UniqueConstraint(name = "uk_merchant_profiles_user_merchant",
                columnNames = {"user_id", "normalized_merchant"})
})
public class MerchantProfile {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "merchant", columnDefinition = "TEXT", nullable = false)
    private String merchant;

    @Column(name = "normalized_merchant", columnDefinition = "TEXT", nullable = false)
    private String normalizedMerchant;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 50)
    private TransactionCategory category;

    @Column(name = "embedding", columnDefinition = "vector(768)", nullable = false)
    private float[] embedding;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public MerchantProfile() {
    }

    public MerchantProfile(UUID userId, String merchant, String normalizedMerchant,
                           String description, TransactionCategory category, float[] embedding) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.merchant = merchant;
        this.normalizedMerchant = normalizedMerchant;
        this.description = description;
        this.category = category;
        this.embedding = embedding;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getMerchant() {
        return merchant;
    }

    public String getNormalizedMerchant() {
        return normalizedMerchant;
    }

    public String getDescription() {
        return description;
    }

    public TransactionCategory getCategory() {
        return category;
    }

    public float[] getEmbedding() {
        return embedding;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    @PrePersist
    @PreUpdate
    void prePersist() {
        this.updatedAt = Instant.now();
    }
}