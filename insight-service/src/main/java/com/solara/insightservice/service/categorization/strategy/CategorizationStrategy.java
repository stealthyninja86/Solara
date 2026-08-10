// insight-service/src/main/java/com/solara/insightservice/service/strategy/categorization/CategorizationStrategy.java
package com.solara.insightservice.service.categorization.strategy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.solara.insightservice.dto.request.CategorizationInput;
import com.solara.insightservice.dto.internal.SimilarCategorization;
import com.solara.insightservice.dto.response.AgentResult;
import com.solara.insightservice.model.TransactionCategory;
import com.solara.insightservice.dto.internal.RAGContext;
import com.solara.insightservice.service.categorization.strategy.LLMStrategy;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.ollama.api.OllamaChatOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

@Service
public class CategorizationStrategy implements LLMStrategy {

    private static final Logger log = LoggerFactory.getLogger(CategorizationStrategy.class);

    private static final String CATEGORIES_AND_RULES = """
            You are a transaction categorizer for a personal finance app.
            The input may be a raw bank narration string (e.g. "UPI-654321@paytm/ZOMATO" or
             "WDL TFR UPI/DR/618545938354/T HUT/YESB/bharatpe90/Pay To 0097695162091 AT 17735"\
             . depends on the bank).
            Extract the merchant name and a clean description from it.

            Return exactly one of these category values (case-sensitive):
            FOOD_DINING, TRANSPORT, FUEL, SHOPPING, CLOTHING, ELECTRONICS, ENTERTAINMENT,
            BILLS_UTILITIES, HEALTHCARE, GROCERIES, PET, RENT, LOAN_EMI, SALARY,
            INVESTMENT, EDUCATION, TRAVEL, OTHER

            Category guidance:
            - FUEL: petrol, diesel or gas refills at fuel stations; not ride fares
            - CLOTHING: apparel, footwear and accessories; not general merchandise
            - ELECTRONICS: phones, computers, gadgets, home appliances and electronics stores
            - PET: pet food, vet care and pet supplies
            - LOAN_EMI: loan and EMI repayments; not regular utility bills

            If the merchant is already clean, echo it back as-is.
            Confidence should reflect how sure you are (0.0 to 1.0).

            Only return a merchant name that is a recognised business (e.g. "Zomato", "Starbucks", "Amul").
            If the narration does not clearly contain a recognised business name, do NOT invent one:
            echo the payee name exactly as it appears in the narration (e.g. "MR VISHNU", "RAMESH SHARMA")
            and set confidence to 0.3 or lower.
            Assign confidence 0.7 or higher only when you are certain of both merchant and category.

            The merchant must be the payee or business name ONLY, 2 to 8 words, a proper noun.
            Never copy the full narration or description as the merchant.
            The description must be a short one-sentence summary, at most 20 words.
            """;

    private static final String SINGLE_OUTPUT_FORMAT = """
            Respond with JSON only. No markdown, no explanations, no tool calls.
            {"category": "FOOD_DINING", "confidence": 0.95, "merchant": "Zomato", "description": "UPI payment to Zomato"}
            """;

    private static final String BATCH_OUTPUT_FORMAT = """
            The user message contains a numbered list of transactions.
            Respond with JSON only, no markdown, no tool calls, matching exactly this schema:
            {"results": [{"category": "FOOD_DINING", "confidence": 0.95, "merchant": "Zomato", "description": "UPI payment to Zomato"}]}

            Return exactly one result object per numbered item, in the same order.
            Never skip, merge, duplicate or reorder items. Every item needs a result.
            If an item is marked as a clean transaction, return only {"category", "confidence"} for it
            (merchant and description may be null or empty).
            If an item cannot be determined, return "category": "OTHER", "confidence": 0.2 and echo
            the payee name as the merchant instead of inventing one.
            """;

    private static final String SYSTEM_PROMPT = CATEGORIES_AND_RULES + "\n" + SINGLE_OUTPUT_FORMAT;
    private static final String BATCH_SYSTEM_PROMPT = CATEGORIES_AND_RULES + "\n" + BATCH_OUTPUT_FORMAT;

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;
    private final OllamaChatOptions.Builder chatOptionsBuilder;
    private final OllamaChatOptions.Builder batchChatOptionsBuilder;
    private final int batchSize;

    public CategorizationStrategy(ChatModel chatModel,
                                  ObjectMapper objectMapper,
                                  @Value("${app.categorization.batch-size:10}") int batchSize) {
        this.chatClient = ChatClient.create(chatModel);
        this.objectMapper = objectMapper;
        this.chatOptionsBuilder = OllamaChatOptions.builder()
                .disableThinking()
                .format(jsonSchema());
        this.batchChatOptionsBuilder = OllamaChatOptions.builder()
                .disableThinking()
                .format(batchJsonSchema());
        this.batchSize = batchSize;
    }

    @Override
    @CircuitBreaker(name = "llmAgent", fallbackMethod = "degraded")
    @Retry(name = "llmAgent")
    public AgentResult execute(CategorizationInput input) {
        String inputToAgent = input.isBulkImport() ? input.merchant() : input.normalizedMerchant();
        String userMessage = buildUserMessage(inputToAgent, input.description(), input.amount(),
                input.examples(), input.ragContext());

        String response = chat(SYSTEM_PROMPT, userMessage, chatOptionsBuilder);
        return parseResponse(response);
    }

    @Override
    @CircuitBreaker(name = "llmAgent", fallbackMethod = "degradedBatch")
    @Retry(name = "llmAgent")
    public List<AgentResult> executeBatch(List<CategorizationInput> inputs) {
        List<AgentResult> results = new ArrayList<>(Collections.nCopies(inputs.size(), null));
        for (int start = 0; start < inputs.size(); start += batchSize) {
            int end = Math.min(inputs.size(), start + batchSize);
            List<CategorizationInput> chunk = inputs.subList(start, end);
            List<AgentResult> chunkResults = resolveChunk(chunk);
            for (int i = 0; i < chunk.size(); i++) {
                results.set(start + i, chunkResults.get(i));
            }
        }
        return results;
    }

    private List<AgentResult> resolveChunk(List<CategorizationInput> chunk) {
        List<AgentResult> results = parseBatchResponse(chat(BATCH_SYSTEM_PROMPT, buildBatchUserMessage(chunk), batchChatOptionsBuilder),
                chunk.size());
        List<Integer> missing = IntStream.range(0, chunk.size())
                .filter(i -> results.get(i) == null)
                .boxed()
                .toList();
        if (missing.isEmpty()) {
            return results;
        }
        log.warn("Batch call returned {} of {} results; re-prompting {} missing items",
                chunk.size() - missing.size(), chunk.size(), missing.size());
        List<CategorizationInput> missingInputs = missing.stream().map(chunk::get).toList();
        List<AgentResult> retryResults = parseBatchResponse(chat(BATCH_SYSTEM_PROMPT, buildBatchUserMessage(missingInputs), batchChatOptionsBuilder),
                missing.size());
        for (int i = 0; i < missing.size(); i++) {
            results.set(missing.get(i), retryResults.get(i));
        }
        return results;
    }

    private String chat(String systemPrompt, String userMessage, OllamaChatOptions.Builder optionsBuilder) {
        long start = System.currentTimeMillis();
        String content = chatClient.prompt()
                .system(systemPrompt)
                .user(userMessage)
                .options(optionsBuilder)
                .call()
                .content();
        log.debug("LLM call completed: durationMs={}, responseLength={}",
                System.currentTimeMillis() - start, content != null ? content.length() : 0);
        return content;
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

    private Map<String, Object> batchJsonSchema() {
        Map<String, Object> item = jsonSchema();
        Map<String, Object> results = new LinkedHashMap<>();
        results.put("type", "array");
        results.put("items", item);

        Map<String, Object> wrapper = new LinkedHashMap<>();
        wrapper.put("type", "object");
        wrapper.put("properties", Map.of("results", results));
        wrapper.put("required", List.of("results"));
        return wrapper;
    }

    private String buildUserMessage(String merchant, String description, BigDecimal amount,
                                    List<SimilarCategorization> examples, RAGContext ragContext) {
        StringBuilder builder = new StringBuilder();
        builder.append("Categorize this transaction:\n");
        builder.append("Merchant: ").append(merchant).append("\n");
        builder.append("Description: ").append(description != null ? description : "").append("\n");
        builder.append("Amount: ").append(amount).append("\n");
        appendExamples(builder, examples);
        appendRAGContext(builder, ragContext);
        return builder.toString();
    }

    private String buildBatchUserMessage(List<CategorizationInput> inputs) {
        StringBuilder builder = new StringBuilder("Categorize these ")
                .append(inputs.size())
                .append(" transactions:\n");
        for (int i = 0; i < inputs.size(); i++) {
            builder.append("\n").append(i + 1).append(". ");
            CategorizationInput input = inputs.get(i);
            builder.append("Merchant: ").append(input.merchant()).append("\n");
            builder.append("Description: ").append(input.description() != null ? input.description() : "").append("\n");
            builder.append("Amount: ").append(input.amount()).append("\n");
            appendExamples(builder, input.examples());
            appendRAGContext(builder, input.ragContext());
        }
        return builder.toString();
    }

    private void appendExamples(StringBuilder builder, List<SimilarCategorization> examples) {
        if (examples == null || examples.isEmpty()) {
            return;
        }
        builder.append("Past similar transactions (hints only, ignore if irrelevant):\n");
        for (SimilarCategorization example : examples) {
            builder.append("- merchant=").append(example.merchant())
                    .append(", category=").append(example.category())
                    .append(", description=")
                    .append(example.description() != null ? example.description() : "")
                    .append("\n");
        }
    }

    private void appendRAGContext(StringBuilder builder, RAGContext ragContext) {
        if (ragContext == null) {
            return;
        }
        if (ragContext.consensus() != null) {
            builder.append("KB category hint: ").append(ragContext.consensus().category())
                    .append(" (confidence ").append(ragContext.consensus().confidence())
                    .append(", from ").append(ragContext.consensus().transactionCount()).append(" prior txns)\n");
        }
    }

    public AgentResult degraded(Throwable t) {
        log.warn("Agent degraded, circuit likely open: {}", t.getMessage());
        return new AgentResult(null, null, "degraded", null, null);
    }

    public List<AgentResult> degradedBatch(List<CategorizationInput> inputs, Throwable t) {
        log.warn("Agent degraded for batch of {} items, circuit likely open: {}", inputs.size(), t.getMessage());
        return new ArrayList<>(Collections.nCopies(inputs.size(), null));
    }

    private AgentResult parseResponse(String response) {
        if (response == null) return null;
        try {
            return parseAgentResult(objectMapper.readTree(stripFences(response)));
        } catch (Exception e) {
            log.warn("Failed to parse agent response: {}", truncate(response));
            return null;
        }
    }

    private List<AgentResult> parseBatchResponse(String response, int expectedSize) {
        List<AgentResult> results = new ArrayList<>(Collections.nCopies(expectedSize, null));
        if (response == null || response.isBlank()) {
            return results;
        }
        try {
            JsonNode resultsNode = objectMapper.readTree(stripFences(response)).path("results");
            if (!resultsNode.isArray()) {
                log.warn("Batch response missing 'results' array: {}", truncate(response));
                return results;
            }
            int index = 0;
            for (JsonNode item : resultsNode) {
                if (index >= expectedSize) break;
                results.set(index, parseAgentResult(item));
                index++;
            }
            if (index < expectedSize) {
                log.warn("Batch response contained {} of {} expected results", index, expectedSize);
            }
        } catch (Exception e) {
            log.warn("Failed to parse batch response: {}", truncate(response));
        }
        return results;
    }

    private AgentResult parseAgentResult(JsonNode node) {
        if (node == null || !node.has("category") || node.get("category").isNull()) {
            return null;
        }
        String categoryString = node.get("category").asText();
        TransactionCategory category;
        try {
            category = TransactionCategory.valueOf(categoryString);
        } catch (IllegalArgumentException e) {
            log.warn("Agent returned invalid category: {}", categoryString);
            return null;
        }
        BigDecimal confidence = BigDecimal.valueOf(node.path("confidence").asDouble());
        String merchant = node.has("merchant") && !node.get("merchant").isNull()
                ? node.get("merchant").asText() : null;
        String description = node.has("description") && !node.get("description").isNull()
                ? node.get("description").asText() : null;
        return new AgentResult(category, confidence, "agent", merchant, description);
    }

    private String stripFences(String response) {
        return response.replaceAll("```json\\s*|```\\s*", "").trim();
    }

    private String truncate(String value) {
        return value.length() > 300 ? value.substring(0, 300) + "..." : value;
    }
}
