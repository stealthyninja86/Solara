package com.solara.insightservice.config;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.solara.insightservice.llm.factory.GeminiChatModelFactory;
import com.solara.insightservice.llm.factory.OllamaChatModelFactory;
import com.solara.insightservice.llm.factory.OllamaCloudChatModelFactory;
import com.solara.insightservice.llm.factory.OpenAiChatModelFactory;
import com.solara.insightservice.model.LlmProvider;
import com.solara.insightservice.dto.response.UserSettingsResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.ollama.OllamaEmbeddingModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.ai.ollama.api.OllamaEmbeddingOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;

import java.util.EnumMap;
import java.util.Map;
import java.util.function.Supplier;

@Configuration
public class LlmConfig {

    private static final Logger log = LoggerFactory.getLogger(LlmConfig.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    private final Map<LlmProvider, com.solara.insightservice.llm.factory.ChatModelFactory> factories =
            new EnumMap<>(LlmProvider.class);
    private final boolean aiEnabled;
    private ChatModel defaultChatModel;

    public LlmConfig(OllamaChatModelFactory ollamaFactory,
                     OpenAiChatModelFactory openAiFactory,
                     GeminiChatModelFactory geminiFactory,
                     OllamaCloudChatModelFactory ollamaCloudFactory,
                     @org.springframework.beans.factory.annotation.Value("${app.ai.enabled:true}") boolean aiEnabled) {
        this.aiEnabled = aiEnabled;
        factories.put(LlmProvider.OLLAMA, ollamaFactory);
        factories.put(LlmProvider.OPENAI, openAiFactory);
        factories.put(LlmProvider.GEMINI, geminiFactory);
        factories.put(LlmProvider.OLLAMA_CLOUD, ollamaCloudFactory);

        defaultChatModel = null;

        log.info("LLM registry initialized with {} providers", factories.size());
    }

    public ChatModel resolve(LlmProvider provider, String apiKey, String model) {
        var factory = factories.get(provider);
        if (factory == null) {
            throw new IllegalArgumentException("No factory for provider: " + provider);
        }
        return factory.create(apiKey, model);
    }

    public ChatModel defaultChatModel() {
        return defaultChatModel;
    }

    public boolean isEnabled() {
        return aiEnabled;
    }

    public static String stripFences(String response) {
        return response.replaceAll("```json\\s*|```\\s*", "").trim();
    }

    public static String truncate(String value, int maxLength) {
        return value.length() > maxLength ? value.substring(0, maxLength) + "..." : value;
    }

    public ChatModel chatClientFor(UserSettingsResponse settings) {
        LlmProvider provider = LlmProvider.valueOf(settings.llmProvider());
        if (provider != LlmProvider.OLLAMA) {
            return resolve(provider, settings.llmApiKey(), settings.llmChatModel());
        }
        return defaultChatModel;
    }

    public ChatOptions.Builder<?> perRequestOptions(UserSettingsResponse settings,
                                                     Map<String, Object> jsonSchema) {
        LlmProvider provider = LlmProvider.valueOf(settings.llmProvider());
        return buildOptions(provider, settings.llmApiKey(), settings.llmChatModel(), jsonSchema);
    }

    public ChatOptions.Builder<?> buildOptions(LlmProvider provider, String apiKey,
                                               String model, Map<String, Object> jsonSchema) {
        String schema = toJsonString(jsonSchema);
        return switch (provider) {
            case OLLAMA -> org.springframework.ai.ollama.api.OllamaChatOptions.builder()
                    .disableThinking().format("json");
            case OLLAMA_CLOUD -> {
                var b = org.springframework.ai.openai.OpenAiChatOptions.builder()
                        .baseUrl("https://ollama.com/v1").outputSchema(schema);
                if (apiKey != null) b.apiKey(apiKey);
                if (model != null) b.model(model);
                yield b;
            }
            case GEMINI -> {
                var b = org.springframework.ai.google.genai.GoogleGenAiChatOptions.builder()
                        .outputSchema(schema);
                if (model != null) b.model(model);
                yield b;
            }
            case OPENAI -> {
                var b = org.springframework.ai.openai.OpenAiChatOptions.builder()
                        .outputSchema(schema);
                if (apiKey != null) b.apiKey(apiKey);
                if (model != null) b.model(model);
                yield b;
            }
        };
    }

    @Bean
    public EmbeddingModel embeddingModel(
            @Value("${spring.ai.ollama.base-url:http://host.docker.internal:11434}") String baseUrl,
            @Value("${spring.ai.ollama.embedding.model:nomic-embed-text}") String model) {
        return OllamaEmbeddingModel.builder()
                .ollamaApi(OllamaApi.builder().baseUrl(baseUrl).build())
                .options(OllamaEmbeddingOptions.builder().model(model).build())
                .build();
    }

    private static String toJsonString(Map<String, Object> schema) {
        try {
            return objectMapper.writeValueAsString(schema);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize JSON schema", e);
        }
    }

    private static final int MAX_RETRIES = 3;

    public static <T> T withRetry(Supplier<T> call, String operationName) {
        Exception lastException = null;
        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                return call.get();
            } catch (HttpClientErrorException.TooManyRequests e) {
                lastException = e;
                long retryAfterMs = parseRetryDelay(e.getResponseBodyAsString());
                log.warn("LLM 429: operation={}, attempt={}/{}, retryAfterMs={}",
                        operationName, attempt, MAX_RETRIES, retryAfterMs);
                sleep(retryAfterMs);
            } catch (HttpClientErrorException e) {
                lastException = e;
                if (e.getStatusCode().is5xxServerError() && attempt < MAX_RETRIES) {
                    log.warn("LLM 5xx: operation={}, attempt={}, status={}",
                            operationName, attempt, e.getStatusCode());
                    sleep(1000L * attempt);
                } else {
                    break;
                }
            } catch (ResourceAccessException e) {
                lastException = e;
                if (attempt < MAX_RETRIES) {
                    log.warn("LLM connection error: operation={}, attempt={}",
                            operationName, attempt);
                    sleep(1000L * attempt);
                } else {
                    break;
                }
            }
        }
        log.warn("LLM failed after {} attempts: operation={}, error={}",
                MAX_RETRIES, operationName,
                lastException != null ? lastException.getMessage() : "unknown");
        return null;
    }

    private static long parseRetryDelay(String body) {
        if (body == null || body.isBlank()) return 5000;
        try {
            var node = objectMapper.readTree(body);
            var retryInfo = node.findValue("retryDelay");
            if (retryInfo != null) {
                String delay = retryInfo.asText();
                if (delay.endsWith("s")) {
                    return (long) (Double.parseDouble(delay.replace("s", "")) * 1000);
                }
                return Long.parseLong(delay);
            }
        } catch (Exception ignored) {
        }
        return 5000;
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
