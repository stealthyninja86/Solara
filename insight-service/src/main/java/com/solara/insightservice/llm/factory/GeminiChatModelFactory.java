package com.solara.insightservice.llm.factory;

import com.google.genai.Client;
import io.micrometer.observation.ObservationRegistry;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.google.genai.GoogleGenAiChatModel;
import org.springframework.ai.google.genai.GoogleGenAiChatOptions;
import org.springframework.ai.model.tool.DefaultToolCallingManager;
import org.springframework.core.retry.RetryTemplate;
import org.springframework.stereotype.Component;

@Component
public class GeminiChatModelFactory implements ChatModelFactory {

    private final RetryTemplate retryTemplate;

    public GeminiChatModelFactory(RetryTemplate retryTemplate) {
        this.retryTemplate = retryTemplate;
    }

    @Override
    public ChatModel create(String apiKey, String model) {
        if (model == null || model.isBlank()) {
            throw new IllegalArgumentException(
                "Model not configured. Please set a model in Settings > LLM Provider.");
        }
        Client genAiClient = Client.builder().apiKey(apiKey).build();
        return new GoogleGenAiChatModel(
                genAiClient,
                GoogleGenAiChatOptions.builder()
                        .model(model)
                        .build(),
                DefaultToolCallingManager.builder().build(),
                retryTemplate,
                ObservationRegistry.NOOP);
    }
}
