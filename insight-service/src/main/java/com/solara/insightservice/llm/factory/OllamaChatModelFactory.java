package com.solara.insightservice.llm.factory;

import io.micrometer.observation.ObservationRegistry;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.model.tool.DefaultToolCallingManager;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.ai.ollama.api.OllamaChatOptions;
import org.springframework.ai.ollama.management.ModelManagementOptions;
import org.springframework.core.retry.RetryTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class OllamaChatModelFactory implements ChatModelFactory {

    @Value("${spring.ai.ollama.base-url:http://host.docker.internal:11434}")
    private String baseUrl;

    private final RetryTemplate retryTemplate;

    public OllamaChatModelFactory(RetryTemplate retryTemplate) {
        this.retryTemplate = retryTemplate;
    }

    @Override
    public ChatModel create(String apiKey, String model) {
        if (model == null || model.isBlank()) {
            throw new IllegalArgumentException(
                "Model not configured. Please set a model in Settings > LLM Provider.");
        }
        return new OllamaChatModel(
                OllamaApi.builder().baseUrl(baseUrl).build(),
                OllamaChatOptions.builder()
                        .model(model)
                        .disableThinking()
                        .build(),
                DefaultToolCallingManager.builder().build(),
                ObservationRegistry.NOOP,
                ModelManagementOptions.builder().build(),
                retryTemplate);
    }
}
