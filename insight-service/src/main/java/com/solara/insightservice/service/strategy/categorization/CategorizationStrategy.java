// insight-service/src/main/java/com/solara/insightservice/service/strategy/categorization/CategorizationStrategy.java
package com.solara.insightservice.service.strategy.categorization;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.solara.insightservice.dto.request.CategorizationInput;
import com.solara.insightservice.dto.request.SimilarCategorization;
import com.solara.insightservice.dto.response.AgentResult;
import com.solara.insightservice.model.TransactionCategory;
import com.solara.insightservice.service.strategy.LLMStrategy;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.ollama.api.OllamaChatOptions;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class CategorizationStrategy implements LLMStrategy {

    private static final Logger log = LoggerFactory.getLogger(CategorizationStrategy.class);

    private static final String SYSTEM_PROMPT = """
        You are a transaction categorizer for a personal finance app.
       \s
        The input may be a raw bank narration string (e.g. "UPI-654321@paytm/ZOMATO" or
         "WDL TFR UPI/DR/618545938354/T HUT/YESB/bharatpe90/Pay To 0097695162091 AT 17735"\s
         . depends on the bank).
        Extract the merchant name and a clean description from it.
       \s
        Return exactly one of these category values (case-sensitive):
        FOOD_DINING, TRANSPORT, SHOPPING, ENTERTAINMENT, BILLS_UTILITIES,
        HEALTHCARE, GROCERIES, RENT, SALARY, INVESTMENT, EDUCATION, TRAVEL, OTHER
       \s
        Respond with JSON only. No markdown, no explanations, no tool calls.
        {"category": "FOOD_DINING", "confidence": 0.95, "merchant": "Zomato", "description": "UPI payment to Zomato"}
       \s
        If the merchant is already clean, echo it back as-is.
        Confidence should reflect how sure you are (0.0 to 1.0).
       \s
        Only return a merchant name that is a recognised business (e.g. "Zomato", "Starbucks", "Amul").
        If the narration does not clearly contain a recognised business name, do NOT invent one:
        echo the payee name exactly as it appears in the narration (e.g. "MR VISHNU", "RAMESH SHARMA")
        and set confidence to 0.3 or lower.
        Assign confidence 0.7 or higher only when you are certain of both merchant and category.

        The merchant must be the payee or business name ONLY, 2 to 8 words, a proper noun.
        Never copy the full narration or description as the merchant.
        The description must be a short one-sentence summary, at most 20 words.
       \s""";

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;
    private final OllamaChatOptions.Builder chatOptionsBuilder;

    public CategorizationStrategy(ChatModel chatModel,
                                  ObjectMapper objectMapper) {
        this.chatClient = ChatClient.create(chatModel);
        this.objectMapper = objectMapper;
        this.chatOptionsBuilder = OllamaChatOptions.builder()
                .disableThinking()
                .format(jsonSchema());
    }

    @Override
    @CircuitBreaker(name = "llmAgent", fallbackMethod = "degraded")
    @Retry(name = "llmAgent")
    public AgentResult execute(CategorizationInput input) {
        String inputToAgent = input.isBulkImport() ? input.merchant() : input.normalizedMerchant();
        String userMessage = buildUserMessage(inputToAgent, input.description(), input.amount(),
                input.examples(), input.isBulkImport());

        String response = chatClient.prompt()
                .system(SYSTEM_PROMPT)
                .user(userMessage)
                .options(chatOptionsBuilder)
                .call()
                .content();

        return parseResponse(response);
    }

    private Map<String, Object> jsonSchema() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("category", Map.of("type", "string"));
        properties.put("confidence", Map.of("type", "number"));
        properties.put("merchant", Map.of("type", "string", "maxLength", 40));
        properties.put("description", Map.of("type", "string", "maxLength", 120));

        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", properties);
        schema.put("required", List.of("category", "confidence"));
        return schema;
    }

    private String buildUserMessage(String merchant, String description, BigDecimal amount,
                                    List<SimilarCategorization> examples, boolean isBulkImport) {
        StringBuilder builder = new StringBuilder();
        if (!isBulkImport) {
            builder.append("This is a clean transaction from the user's records. ");
            builder.append("Do not extract or clean the merchant or description; ");
            builder.append("return only {\"category\", \"confidence\"}.\n");
        }
        builder.append("Categorize this transaction:\n");
        builder.append("Merchant: ").append(merchant).append("\n");
        builder.append("Description: ").append(description != null ? description : "").append("\n");
        builder.append("Amount: ").append(amount).append("\n");
        if (examples != null && !examples.isEmpty()) {
            builder.append("\nPast similar transactions (hints only, ignore if irrelevant):\n");
            for (SimilarCategorization example : examples) {
                builder.append("- merchant=").append(example.merchant())
                        .append(", category=").append(example.category())
                        .append(", description=")
                        .append(example.description() != null ? example.description() : "")
                        .append("\n");
            }
        }
        return builder.toString();
    }

    public AgentResult degraded(Throwable t) {
        log.warn("Agent degraded, circuit likely open: {}", t.getMessage());
        return new AgentResult(null, null, "degraded", null, null);
    }

    private AgentResult parseResponse(String response) {
        if (response == null) return null;
        try {
            String json = response.replaceAll("```json\\s*|```\\s*", "").trim();
            JsonNode node = objectMapper.readTree(json);
            String categoryStr = node.get("category").asText();
            TransactionCategory category;
            try {
                category = TransactionCategory.valueOf(categoryStr);
            } catch (IllegalArgumentException e) {
                log.warn("Agent returned invalid category: {}", categoryStr);
                category = null;
            }
            BigDecimal confidence = BigDecimal.valueOf(node.get("confidence").asDouble());
            String merchant = node.has("merchant") && !node.get("merchant").isNull()
                    ? node.get("merchant").asText() : null;
            String description = node.has("description") && !node.get("description").isNull()
                    ? node.get("description").asText() : null;
            return new AgentResult(category, confidence, "agent", merchant, description);
        } catch (Exception e) {
            log.warn("Failed to parse agent response: {}", response);
            return null;
        }
    }
}