package com.solara.insightservice.service.insight;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.solara.insightservice.config.TracedExecutors;
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
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

@Component
public class InsightTextWriter {

    private static final Logger log = LoggerFactory.getLogger(InsightTextWriter.class);

    private static final Duration PROBE_TIMEOUT = Duration.ofSeconds(2);

    private static final String ANALYST_PROMPT =
            """
            You are Solara, a warm and practical personal finance assistant.
            
            You are given ONE financial fact. The fact contains values that you may reference using tokens such as [fact.current] and [fact.change].
            
            Write one friendly, personal insight card that explains to the person
            what happened, as if a supportive friend were explaining it.

            OUTPUT:
            {
              "headline": "...",
              "body": "...",
              "suggestion": "..."
            }

            RULES:

            1. Speak directly to the person using "you".
            2. Keep the tone warm, natural, and conversational — like a friend
               chatting over coffee, not a bank statement or a report. Friendly
               openings such as "Heads up" or "Good news" are welcome.
            3. Headline: maximum 220 characters. Keep it short and friendly.
            4. Body: maximum 900 characters — aim for 6-8 full lines of clear
               explanation (roughly 550-750 characters), so the person fully
               understands what happened and why it matters. Two or three lines is
               not enough.
            5. Suggestion: maximum 400 characters — a short friendly next step.
            6. Use only information contained in the supplied fact.
            7. Values must ALWAYS be written using their supplied [fact.x] token.
            8. Never write numbers, percentages, amounts, currency symbols, or multipliers yourself.
            9. Never introduce a comparison, reason, trend, habit, or conclusion that is not explicitly present in the fact.
            10. You may describe direction using words such as "up", "down", "higher", or "lower".
            11. If the fact does not contain enough information to make a statement, leave that statement out.
            12. Do not use technical financial language.
            13. Do not mention the words "delta", "magnitude", "allocation", "potential", "cycle", "core", "overage", "vs", "percent", or "previous levels".
            14. Match the supplied direction exactly: if direction is "up" or the change is positive, say spending rose or is higher; if direction is "down" or the change is negative, say it fell or is lower. Never invert the sign or the direction.
            15. Return JSON only. No markdown or additional text.
            16. The response is rejected if any field exceeds its character limit, so keep each field comfortably shorter than the cap.
            
            IMPORTANT:
            Every value in the response must appear as a [fact.x] token exactly as provided.
            """;

    private static final String ADVISOR_PROMPT =
            """
            You are Solara, a warm and practical personal finance coach.
            
            You are given ONE financial fact. The fact contains values that you may reference using tokens such as [fact.current] and [fact.change].
            
            Write one friendly, personal card that gives the person ONE useful
            action, explained like a supportive friend would.

            OUTPUT:
            {
              "headline": "...",
              "body": "...",
              "suggestion": "..."
            }

            RULES:

            1. Speak directly to the person using "you".
            2. Be warm and encouraging, never bossy or judgmental — the action
               should feel like a helpful suggestion from a friend, not a command.
            3. Headline: maximum 220 characters. Keep it short and friendly.
            4. Body: maximum 1200 characters — aim for 8-10 full lines of clear
               explanation (roughly 700-1000 characters), so the person fully
               understands the situation and the reason for the action. Two or
               three lines is not enough.
            5. Suggestion: maximum 400 characters — a short friendly next step.
            6. Give exactly ONE action.
            7. The action must be supported by the supplied fact.
            8. Use only information contained in the supplied fact.
            9. Values must ALWAYS be written using their supplied [fact.x] token.
            10. Never write numbers, percentages, amounts, currency symbols, or multipliers yourself.
            11. Never invent a reason, comparison, trend, habit, saving amount, or outcome.
            12. Do not repeat the obvious status statement. Focus on what the person can do next.
            13. If the fact does not support a useful action, give a gentle monitoring action instead.
            14. Avoid technical financial language.
            15. Do not use the words "delta", "magnitude", "allocation", "potential", "cycle", "core", "overage", "vs", "percent", "again", "check-in", or "previous levels".
            16. Match the supplied direction exactly: if direction is "up" or the change is positive, say spending rose or is higher; if direction is "down" or the change is negative, say it fell or is lower. Never invert the sign or the direction.
            16. Return JSON only. No markdown or additional text.
            17. The response is rejected if any field exceeds its character limit, so keep each field comfortably shorter than the cap.
            
            IMPORTANT:
            Every value in the response must appear as a [fact.x] token exactly as provided.
            """;

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;
    private final OllamaChatOptions.Builder chatOptionsBuilder;
    private final Executor cardTextExecutor;
    private final HttpClient probeClient;
    private final URI ollamaTagsEndpoint;

    public InsightTextWriter(ChatModel chatModel, ObjectMapper objectMapper,
                             @Value("${spring.ai.ollama.base-url}") String ollamaBaseUrl) {
        this.chatClient = ChatClient.create(chatModel);
        this.objectMapper = objectMapper;
        this.chatOptionsBuilder = OllamaChatOptions.builder()
                .disableThinking()
                .format(jsonSchema())
                .presencePenalty(1.5);
        this.cardTextExecutor = TracedExecutors.decorated(Executors.newVirtualThreadPerTaskExecutor());
        this.probeClient = HttpClient.newBuilder()
                .connectTimeout(PROBE_TIMEOUT)
                .build();
        this.ollamaTagsEndpoint = URI.create(ollamaBaseUrl + "/api/tags");
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
        String previousLine = fact.previousValue() != null
                ? "previous   = " + token + ".previous\n"
                : "";
        String changeLine = fact.changePercent() != null
                ? "change     = " + token + ".delta   (direction: " + directionOf(fact) + ")\n"
                : "";
        String hintLine = (fact.hint() != null && !fact.hint().isBlank())
                ? "What these values mean: " + fact.hint() + ".\n"
                : "";
        String availableTokens = token
                + (previousLine.isBlank() ? "" : ", " + token + ".previous")
                + (changeLine.isBlank() ? "" : ", " + token + ".delta");
        String base = """
            Fact: %s
            current    = %s
            %s
            %s
            %s
            Your numbers are only available as the tokens %s —
            always state them through those tokens, never write a number yourself.
            """.trim().formatted(fact.label(), token,
                    previousLine,
                    changeLine,
                    hintLine,
                    availableTokens);
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
