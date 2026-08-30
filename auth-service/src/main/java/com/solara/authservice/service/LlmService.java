package com.solara.authservice.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.solara.authservice.dto.response.LlmModelsResponse;
import com.solara.authservice.dto.response.LlmProvidersResponse;
import com.solara.authservice.dto.response.ModelInfo;
import com.solara.authservice.dto.response.ProviderInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class LlmService {

    private static final Logger log = LoggerFactory.getLogger(LlmService.class);
    private final RestClient restClient = RestClient.create();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final String ollamaBaseUrl;
    private final String ollamaCloudModelsUrl;
    private final String geminiModelsUrl;
    private final String openAiModelsUrl;

    public LlmService(
            @Value("${app.llm.ollama.base-url}") String ollamaBaseUrl,
            @Value("${app.llm.ollama-cloud.models-url}") String ollamaCloudModelsUrl,
            @Value("${app.llm.gemini.models-url}") String geminiModelsUrl,
            @Value("${app.llm.openai.models-url}") String openAiModelsUrl) {
        this.ollamaBaseUrl = ollamaBaseUrl;
        this.ollamaCloudModelsUrl = ollamaCloudModelsUrl;
        this.geminiModelsUrl = geminiModelsUrl;
        this.openAiModelsUrl = openAiModelsUrl;
    }

    public LlmProvidersResponse getProviders() {
        List<ProviderInfo> providers = List.of(
            new ProviderInfo(
                "OLLAMA",
                "Ollama (local)",
                "Free — runs on your machine",
                List.of(),
                false,
                null,
                "http://localhost:11434"
            ),
            new ProviderInfo(
                "OLLAMA_CLOUD",
                "Ollama Cloud",
                "Cloud-hosted Ollama — free tier available",
                List.of(
                    "Head over to ollama.com and sign in to your account.",
                    "Navigate to Settings and click on API Keys.",
                    "Create a new key, give it a name you'll remember, and copy it.",
                    "Paste it above and hit Validate. The free plan gives you light usage of select models — great for trying things out."
                ),
                true,
                "ollama_v2_...",
                "https://ollama.com/settings"
            ),
            new ProviderInfo(
                "GEMINI",
                "Gemini",
                "Google AI — free tier available",
                List.of(
                    "Go to aistudio.google.com and click Get API key.",
                    "You can create a key in any Google Cloud project (or create a new one).",
                    "Paste your key above and click Validate to see available models.",
                    "Select a model from the dropdown — Flash models are free."
                ),
                true,
                "AIza...",
                "https://aistudio.google.com/apikey"
            ),
            new ProviderInfo(
                "OPENAI",
                "OpenAI",
                "GPT models — paid",
                List.of(
                    "Log in to platform.openai.com and go to API keys.",
                    "Click Create new secret key and copy it immediately (it won't be shown again).",
                    "Make sure to add a payment method under Settings \u2192 Billing \u2014 GPT models are pay-per-use.",
                    "Paste your key above and click Validate to load the model list."
                ),
                true,
                "sk-...",
                "https://platform.openai.com/settings/organization/api-keys"
            )
        );
        return new LlmProvidersResponse(providers, "OLLAMA");
    }

    public LlmModelsResponse getModels(String provider, String apiKey) {
        return switch (provider.toUpperCase()) {
            case "OLLAMA" -> getOllamaModels();
            case "OLLAMA_CLOUD" -> getOllamaCloudModels(apiKey);
            case "GEMINI" -> getGeminiModels(apiKey);
            case "OPENAI" -> getOpenAiModels(apiKey);
            default -> throw new IllegalArgumentException("Unsupported provider: " + provider);
        };
    }

    private LlmModelsResponse getOllamaModels() {
        return fetchModels("OLLAMA", ollamaBaseUrl + "/api/tags", null, root -> {
            List<ModelInfo> models = new ArrayList<>();
            for (JsonNode model : root.get("models")) {
                String name = model.get("name").asText();
                JsonNode details = model.has("details") ? model.get("details") : null;
                JsonNode capabilities = model.has("capabilities") ? model.get("capabilities") : null;

                boolean isEmbeddingOnly = false;
                if (capabilities != null && capabilities.isArray()) {
                    isEmbeddingOnly = capabilities.size() == 1
                            && capabilities.get(0).asText().equals("embedding");
                }
                if (isEmbeddingOnly) continue;

                String parameterSize = details != null && details.has("parameter_size")
                        ? details.get("parameter_size").asText() : null;
                String quantization = details != null && details.has("quantization_level")
                        ? details.get("quantization_level").asText() : null;
                String family = details != null && details.has("family")
                        ? details.get("family").asText() : null;
                Long contextWindow = details != null && details.has("context_length")
                        ? details.get("context_length").asLong() : null;

                String description = Stream.of(parameterSize, quantization, family)
                        .filter(s -> s != null && !s.isEmpty())
                        .collect(Collectors.joining(" \u00b7 "));

                models.add(new ModelInfo(name, description.isEmpty() ? null : description, contextWindow));
            }
            return models;
        });
    }

    private LlmModelsResponse getOllamaCloudModels(String apiKey) {
        return fetchModels("OLLAMA_CLOUD", ollamaCloudModelsUrl, "Bearer " + apiKey, root -> {
            List<ModelInfo> models = new ArrayList<>();
            for (JsonNode model : root.get("data")) {
                models.add(new ModelInfo(model.get("id").asText(), null, null));
            }
            return models;
        });
    }

    private LlmModelsResponse getGeminiModels(String apiKey) {
        return fetchModels("GEMINI", geminiModelsUrl + "?key=" + apiKey, null, root -> {
            List<ModelInfo> models = new ArrayList<>();
            for (JsonNode model : root.get("models")) {
                String name = model.get("name").asText();
                if (name.startsWith("models/")) {
                    name = name.substring("models/".length());
                }
                String displayName = model.has("displayName") ? model.get("displayName").asText() : null;
                Long contextWindow = model.has("inputTokenLimit") ? model.get("inputTokenLimit").asLong() : null;
                models.add(new ModelInfo(name, displayName, contextWindow));
            }
            return models;
        });
    }

    private LlmModelsResponse getOpenAiModels(String apiKey) {
        return fetchModels("OPENAI", openAiModelsUrl, "Bearer " + apiKey, root -> {
            List<ModelInfo> models = new ArrayList<>();
            for (JsonNode model : root.get("data")) {
                models.add(new ModelInfo(model.get("id").asText(), null, null));
            }
            return models;
        });
    }

    @FunctionalInterface
    private interface ModelExtractor {
        List<ModelInfo> extract(JsonNode root) throws Exception;
    }

    private LlmModelsResponse fetchModels(String provider, String url, String authHeader, ModelExtractor extractor) {
        try {
            var request = restClient.get().uri(url);
            if (authHeader != null) {
                request = request.header("Authorization", authHeader);
            }
            String response = request.retrieve().body(String.class);
            JsonNode root = objectMapper.readTree(response);
            List<ModelInfo> models = extractor.extract(root);
            return new LlmModelsResponse(provider, models);
        } catch (Exception e) {
            log.warn("Failed to fetch {} models: {}", provider, e.getMessage());
            return new LlmModelsResponse(provider, List.of());
        }
    }
}
