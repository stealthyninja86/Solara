package com.solara.insightservice.service.strategy.insight;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.solara.insightservice.dto.response.InsightFact;
import com.solara.insightservice.dto.response.InsightTextResponse;
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
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The LLM path of card writing — one call per fact, values referenced only as
 * {@code [fact.x]} tokens the backend substitutes (the validator guarantees
 * the model stayed in token land). Wrapped in the Resilience4j trio mandated by
 * AGENTS.md: {@code @CircuitBreaker} → {@code @Retry} → {@code @TimeLimiter}.
 *
 * <p>{@code @TimeLimiter} requires a {@link CompletableFuture} return type, so
 * this method is async: the blocking Ollama call runs on a dedicated
 * virtual-thread executor (AGENTS.md mandates virtual threads for LLM
 * blocking — platform threads would saturate on 10-30s LLM calls) and the
 * caller joins the future.</p>
 *
 * <p>Degradation is explicit: a circuit-open, timeout, or parse failure makes
 * this method return {@code null}. {@code InsightGenerator} propagates that —
 * the fact's card is dropped from the feed. The feed can never 500 because the
 * LLM was slow, and it can never show half-cooked card text.</p>
 *
 * <p>Penalty sampling: {@code presencePenalty(1.5)} is the documented fix for
 * qwen3's thinking-token repetition loop (ollama#14493 — the model card
 * itself recommends {@code presence_penalty=1.5}). Without it, qwen3:4b on
 * Ollama 0.30.11 can run away to 1900+ tokens and block the single server
 * slot, which makes every card-writing call time out.</p>
 *
 * <p>Also owns the Ollama liveness probe ({@link #isAvailable()}) — this is
 * the only class with direct Ollama contact, so the settings page's
 * "AI service unavailable" message reads the same runtime health the card
 * path would see. A 2s bounded probe is cheaper than a card-writing call and has
 * no side effects.</p>
 */
@Component
public class InsightTextWriter {

    private static final Logger log = LoggerFactory.getLogger(InsightTextWriter.class);

    private static final Duration PROBE_TIMEOUT = Duration.ofSeconds(2);

    private static final String SYSTEM_PROMPT = """
            You write one short insight card for a personal finance app.
            You are given one fact with its values, referenced ONLY as [fact.x] tokens.

            The card answers three questions in plain, calm English:
            - headline: what changed (≤ 8 words)
            - body: why it matters, with the numbers (≤ 25 words)
            - suggestion: one concrete next step the user can take (≤ 15 words)

            Rules:
            - Never write a number, currency symbol, percent sign or "x" yourself.
            - Reference values only through the provided [fact.x] tokens.
            - You may mention the direction of change (up/down/over) in words.
            - No filler ("vs", "coming up", "now"). Say what changed and what to do.
            - Respond with JSON only, no markdown, no prose:
            {"headline": "...", "body": "...", "suggestion": "..."}
            """;

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;
    private final OllamaChatOptions.Builder chatOptionsBuilder;
    private final ExecutorService cardTextExecutor;
    private final HttpClient probeClient;
    private final URI ollamaTagsEndpoint;

    public InsightTextWriter(ChatModel chatModel, ObjectMapper objectMapper,
                             @Value("${spring.ai.ollama.base-url}") String ollamaBaseUrl) {
        this.chatClient = ChatClient.create(chatModel);
        this.objectMapper = objectMapper;
        this.chatOptionsBuilder = OllamaChatOptions.builder()
                .disableThinking()
                .presencePenalty(1.5);
        this.cardTextExecutor = Executors.newVirtualThreadPerTaskExecutor();
        this.probeClient = HttpClient.newBuilder()
                .connectTimeout(PROBE_TIMEOUT)
                .build();
        this.ollamaTagsEndpoint = URI.create(ollamaBaseUrl + "/api/tags");
    }

    @CircuitBreaker(name = "insight-generator", fallbackMethod = "degraded")
    @Retry(name = "insight-generator")
    @TimeLimiter(name = "insight-generator")
    public CompletableFuture<InsightTextResponse> write(InsightFact fact) {
        return CompletableFuture.supplyAsync(() -> callModel(fact), cardTextExecutor);
    }

    private InsightTextResponse callModel(InsightFact fact) {
        long start = System.currentTimeMillis();
        String response = chatClient.prompt()
                .system(SYSTEM_PROMPT)
                .user(buildUserMessage(fact))
                .options(chatOptionsBuilder)
                .call()
                .content();
        log.debug("Insight card LLM call: fact={}, durationMs={}",
                fact.id(), System.currentTimeMillis() - start);
        return parseResponse(response);
    }

    public boolean isAvailable() {
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

    private String buildUserMessage(InsightFact fact) {
        String token = fact.tokenReference();
        return """
            Fact: %s
            current    = %s    (%s)
            previous   = %s    (%s)
            change     = %s    (%s)

            Write the card. Refer to the values as %s,
            %s and %s.
            """.trim().formatted(fact.label(), token, fact.value(),
                    token + ".previous", fact.previousValue(),
                    token + ".delta", fact.changePercent(),
                    token, token + ".previous", token + ".delta");
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

    public CompletableFuture<InsightTextResponse> degraded(Throwable t) {
        log.warn("Card text degraded: {}", t.getMessage());
        return CompletableFuture.completedFuture(null);
    }

    private String truncate(String value) {
        return value.length() > 300 ? value.substring(0, 300) + "..." : value;
    }
}
