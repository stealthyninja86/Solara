package com.solara.insightservice.service.insight;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.solara.insightservice.config.LlmConfig;
import com.solara.insightservice.config.TracedExecutors;
import com.solara.insightservice.dto.response.InsightFact;
import com.solara.insightservice.dto.response.InsightTextResponse;
import com.solara.insightservice.dto.response.UserSettingsResponse;
import com.solara.insightservice.model.InsightType;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

@Component
public class InsightTextWriter {

    private static final Logger log = LoggerFactory.getLogger(InsightTextWriter.class);

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

    private final ObjectMapper objectMapper;
    private final Executor cardTextExecutor;
    private final LlmConfig llmConfig;

    public InsightTextWriter(LlmConfig llmConfig, ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.cardTextExecutor = TracedExecutors.decorated(Executors.newVirtualThreadPerTaskExecutor());
        this.llmConfig = llmConfig;
    }

    public CompletableFuture<InsightTextResponse> write(InsightFact fact, UserSettingsResponse settings) {
        return CompletableFuture.supplyAsync(() -> callModel(fact, null, settings), cardTextExecutor);
    }

    public CompletableFuture<InsightTextResponse> writeCorrected(InsightFact fact, String rejection, UserSettingsResponse settings) {
        return CompletableFuture.supplyAsync(() -> callModel(fact, rejection, settings), cardTextExecutor);
    }

    private InsightTextResponse callModel(InsightFact fact, String rejection, UserSettingsResponse settings) {
        if (!llmConfig.isEnabled()) {
            log.debug("AI disabled (app.ai.enabled=false) — no card text call: fact={}", fact.id());
            return null;
        }
        if (settings == null || settings.llmProvider() == null) {
            log.debug("No user settings — skipping card text call: fact={}", fact.id());
            return null;
        }
        ChatOptions.Builder<?> options = llmConfig.perRequestOptions(settings, jsonSchema());
        ChatModel client = llmConfig.chatClientFor(settings);
        List<Message> messages = List.of(
                new SystemMessage(promptFor(fact.type())),
                new UserMessage(buildUserMessage(fact, rejection))
        );
        Prompt prompt = new Prompt(messages, options.build());
        return LlmConfig.withRetry(() -> parseResponse(client.call(prompt).getResult().getOutput().getText()),
                "insight-text-" + fact.type());
    }

    private String promptFor(InsightType type) {
        return type == InsightType.ACTION ? ADVISOR_PROMPT : ANALYST_PROMPT;
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
            String json = LlmConfig.stripFences(response);
            JsonNode node = objectMapper.readTree(json);
            return new InsightTextResponse(
                    node.get("headline").asText(),
                    node.get("body").asText(),
                    node.get("suggestion").asText());
        } catch (Exception e) {
            log.warn("Failed to parse card text: {}", LlmConfig.truncate(response, 300));
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
}
