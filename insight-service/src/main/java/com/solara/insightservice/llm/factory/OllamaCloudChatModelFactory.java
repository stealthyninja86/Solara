package com.solara.insightservice.llm.factory;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.stereotype.Component;

@Component
public class OllamaCloudChatModelFactory implements ChatModelFactory {

    @Override
    public ChatModel create(String apiKey, String model) {
        if (model == null || model.isBlank()) {
            throw new IllegalArgumentException(
                "Model not configured. Please set a model in Settings > LLM Provider.");
        }
        return OpenAiChatModel.builder()
                .options(OpenAiChatOptions.builder()
                        .baseUrl("https://ollama.com/v1")
                        .apiKey(apiKey)
                        .model(model)
                        .build())
                .build();
    }
}
