package com.solara.authservice.entity;

import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "llm_provider_config", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id", "provider"})
})
public class LlmProviderConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 20)
    private String provider;

    @Column(name = "api_key", length = 500)
    private String apiKey;

    @Column(length = 100)
    private String model;

    @Column(length = 500)
    private String description;

    public LlmProviderConfig() {
    }

    public LlmProviderConfig(UUID userId, String provider) {
        this.userId = userId;
        this.provider = provider;
    }

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

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
