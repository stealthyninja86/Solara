package com.solara.insightservice.service.insight;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.solara.insightservice.dto.response.InsightFact;
import com.solara.insightservice.dto.response.InsightTextResponse;
import com.solara.insightservice.model.InsightType;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import io.github.resilience4j.timelimiter.annotation.TimeLimiter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.ollama.api.OllamaChatOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Component
public class InsightTextWriter {

    private static final Logger log = LoggerFactory.getLogger(InsightTextWriter.class);

    private static final Duration PROBE_TIMEOUT = Duration.ofSeconds(2);

    private static final String ANALYST_PROMPT = """
            You are a warm, plain-spoken friend who helps someone understand their own finances.
            You are given one fact with its values, referenced ONLY as [fact.x] tokens.

            Write one short insight card that explains the situation:
            - headline: what happened, in plain words (≤ 8 words)
            - body: what it means for the person, with the numbers (≤ 25 words)
            - suggestion: one thing to watch (≤ 12 words)

            Rules:
            - Talk to "you" — personal, warm, human. Never corporate, never mechanical.
            - Never write a number, currency symbol, percent sign, "$" or "x" yourself.
            - Never name any currency (dollar, rupee, pound, euro, yen) — the amounts
              already carry their own symbol.
            - Never estimate an amount or percentage in words ("a bit over one percent").
              If you cannot say it with a token, don't say it.
            - Reference values only through the provided [fact.x] tokens.
            - You may mention the direction of change (up/down/over) in words.
            - State ONLY what the fact gives you. Never invent comparisons, trends,
              habits, or reasons that are not in the fact. If a value is missing,
              don't mention it.
            - Ban these words and phrases: delta, magnitude, allocation, potential,
              "contribution habit", "previous levels", "vs", "coming up", "current level",
              "cycle", "core", "again", "check-in", "remains", "overage". Say "spending",
              "money", "last month" instead.
            - Respond with JSON only, no markdown, no prose:
            {"headline": "...", "body": "...", "suggestion": "..."}
            """;

    private static final String ADVISOR_PROMPT = """
            You are a warm, practical finance coach advising one person on one action, in a personal finance app.
            You are given one fact with its values, referenced ONLY as [fact.x] tokens.

            Write one short insight card that tells the person what to do:
            - headline: the action, as a friendly imperative (≤ 8 words)
            - body: why it matters, with the numbers (≤ 25 words)
            - suggestion: one concrete, doable next step (≤ 15 words)

            Rules:
            - Talk to "you" — personal, warm, human. Encourage, don't scold.
            - Never write a number, currency symbol, percent sign, "$" or "x" yourself.
            - Never name any currency (dollar, rupee, pound, euro, yen) — the amounts
              already carry their own symbol.
            - Never estimate an amount or percentage in words ("a bit over one percent").
              If you cannot say it with a token, don't say it.
            - Reference values only through the provided [fact.x] tokens.
            - You may mention the direction of change (up/down/over) in words.
            - State ONLY what the fact gives you. Never invent comparisons, "again",
              "vs last time", or reasons not in the fact. If a value is missing,
              don't mention it.
            - The person has already seen the status cards explaining what happened.
              Do NOT restate them — give a fresh, specific action they can take today.
            - Ban these words and phrases: delta, magnitude, allocation, potential,
              "contribution habit", "previous levels", "vs", "cycle", "core", "again",
              "check-in", "remains", "overage".
            - Respond with JSON only, no markdown, no prose:
            {"headline": "...", "body": "...", "suggestion": "..."}
            """;

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;
    private final OllamaChatOptions.Builder chatOptionsBuilder;
    private final ExecutorService cardTextExecutor;
    private final HttpClient probeClient;
    private final URI ollamaTagsEndpoint;
    private final boolean aiEnabled;

    public InsightTextWriter(ChatModel chatModel, ObjectMapper objectMapper,
                             @Value("${spring.ai.ollama.base-url:http://host.docker.internal:11434}") String ollamaBaseUrl,
                             @Value("${app.ai.enabled:true}") boolean aiEnabled) {
        this.chatClient = ChatClient.create(chatModel);
        this.objectMapper = objectMapper;
        this.chatOptionsBuilder = OllamaChatOptions.builder()
                .disableThinking()
                .format(jsonSchema())
                .presencePenalty(1.5);
        this.cardTextExecutor = Executors.newVirtualThreadPerTaskExecutor();
        this.probeClient = HttpClient.newBuilder()
                .connectTimeout(PROBE_TIMEOUT)
                .build();
        this.ollamaTagsEndpoint = URI.create(ollamaBaseUrl + "/api/tags");
        this.aiEnabled = aiEnabled;
    }

    @CircuitBreaker(name = "insight-generator", fallbackMethod = "degraded")
    @Retry(name = "insight-generator")
    @TimeLimiter(name = "insight-generator")
    public CompletableFuture<InsightTextResponse> write(InsightFact fact) {
        return CompletableFuture.supplyAsync(() -> callModel(fact, null), cardTextExecutor);
    }

    @CircuitBreaker(name = "insight-generator", fallbackMethod = "degraded")
    @Retry(name = "insight-generator")
    @TimeLimiter(name = "insight-generator")
    public CompletableFuture<InsightTextResponse> writeCorrected(InsightFact fact, String rejection) {
        return CompletableFuture.supplyAsync(() -> callModel(fact, rejection), cardTextExecutor);
    }

    private InsightTextResponse callModel(InsightFact fact, String rejection) {
        if (!aiEnabled) {
            log.debug("AI disabled (app.ai.enabled=false) — no card text call: fact={}", fact.id());
            return null;
        }
        long start = System.currentTimeMillis();
        String response = chatClient.prompt()
                .system(promptFor(fact.type()))
                .user(buildUserMessage(fact, rejection))
                .options(chatOptionsBuilder)
                .call()
                .content();
        log.debug("Insight card LLM call: fact={}, type={}, corrected={}, durationMs={}",
                fact.id(), fact.type(), rejection != null, System.currentTimeMillis() - start);
        return parseResponse(response);
    }

    private String promptFor(InsightType type) {
        return type == InsightType.ACTION ? ADVISOR_PROMPT : ANALYST_PROMPT;
    }

    public boolean isAvailable() {
        if (!aiEnabled) {
            return false;
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(ollamaTagsEndpoint)
                    .timeout(PROBE_TIMEOUT)
                    .GET()
                    .build();
            HttpResponse<Void> response = probeClient.send(request, HttpResponse.BodyHandlers.discarding());
            return response.statusCode() == 200;
        } catch (Exception e) {
            log.debug("Ollama availability probe failed: {}", e.getMessage());
            return false;
        }
    }

    private String buildUserMessage(InsightFact fact, String rejection) {
        String token = fact.tokenReference();
        String changeLine = fact.changePercent() != null
                ? "change     = " + token + ".delta   (direction: " + directionOf(fact) + ")\n"
                : "";
        String hintLine = (fact.hint() != null && !fact.hint().isBlank())
                ? "What these values mean: " + fact.hint() + ".\n"
                : "";
        String base = """
            Fact: %s
            current    = %s
            previous   = %s
            %s
            %s
            Your numbers are only available as the tokens %s, %s and %s —
            always state them through those tokens, never write a number yourself.
            """.trim().formatted(fact.label(), token,
                    token + ".previous",
                    changeLine,
                    hintLine,
                    token, token + ".previous", token + ".delta");
        if (rejection == null || rejection.isBlank()) return base;
        return base + "\n\nYour previous attempt was rejected: " + rejection
                + "\nRewrite the card now, and fix the rejection.";
    }

    private String directionOf(InsightFact fact) {
        if (fact.changePercent() == null) return "unchanged";
        double change = Double.parseDouble(fact.changePercent());
        if (change > 0) return "up";
        if (change < 0) return "down";
        return "unchanged";
    }

    private InsightTextResponse parseResponse(String response) {
        if (response == null) return null;
        try {
            String json = response.replaceAll("```json\\s*|```\\s*", "").trim();
            JsonNode node = objectMapper.readTree(json);
            return new InsightTextResponse(
                    node.get("headline").asText(),
                    node.get("body").asText(),
                    node.get("suggestion").asText());
        } catch (Exception e) {
            log.warn("Failed to parse card text: {}", truncate(response));
            return null;
        }
    }

    private Map<String, Object> jsonSchema() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("headline", Map.of("type", "string"));
        properties.put("body", Map.of("type", "string"));
        properties.put("suggestion", Map.of("type", "string"));

        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", properties);
        schema.put("required", List.of("headline", "body", "suggestion"));
        return schema;
    }

    public CompletableFuture<InsightTextResponse> degraded(Throwable t) {
        log.warn("Card text degraded: {}", t.getMessage());
        return CompletableFuture.completedFuture(null);
    }

    private String truncate(String value) {
        return value.length() > 300 ? value.substring(0, 300) + "..." : value;
    }
}
