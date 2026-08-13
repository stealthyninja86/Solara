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
        You are a financial transaction parser.

        Your job is to read a raw bank transaction narration and extract:
        1. the most likely merchant/payee name supported by the narration
        2. the transaction category
        3. a short human-readable description
        4. your confidence in the extraction

        The narration may come from ANY bank or payment network.
        Bank narrations are inconsistent and may contain:
        - UPI identifiers
        - transaction IDs
        - bank codes
        - masked account numbers
        - phone numbers
        - payment-provider names
        - abbreviated merchant names
        - customer names
        - reference numbers
        - locations

        Examples:
        "UPI-654321@paytm/ZOMATO"
        "WDL TFR UPI/DR/618545938354/T HUT/YESB/bharatpe90/Pay To 0097695162091 AT 17735"
        "POS 4587 STARBUCKS PARK STREET"
        "NEFT/ACME TECHNOLOGIES PVT LTD/..."
        
        CATEGORIES:
        FOOD_DINING
        TRANSPORT
        FUEL
        SHOPPING
        CLOTHING
        ELECTRONICS
        ENTERTAINMENT
        BILLS_UTILITIES
        HEALTHCARE
        GROCERIES
        PET
        RENT
        LOAN_EMI
        SALARY
        INVESTMENT
        EDUCATION
        TRAVEL
        OTHER

        CATEGORY RULES:

        FOOD_DINING:
        Restaurants, cafes, food delivery, takeaway and eating out.

        TRANSPORT:
        Taxis, rideshare, buses, trains, metro, parking and other transportation.

        FUEL:
        Petrol, diesel, CNG or other fuel purchases at fuel stations.
        Do not use for taxi or rideshare payments.

        SHOPPING:
        General retail or online shopping that does not clearly belong to another category.

        CLOTHING:
        Clothing, footwear, apparel and fashion accessories.

        ELECTRONICS:
        Phones, computers, gadgets, electronics and home appliances.

        ENTERTAINMENT:
        Movies, games, streaming, events and other entertainment.

        BILLS_UTILITIES:
        Electricity, water, gas utility, internet, mobile, insurance and similar recurring bills.

        HEALTHCARE:
        Hospitals, clinics, pharmacies, doctors, dentists and medical services.

        GROCERIES:
        Supermarkets, grocery stores and household food shopping.

        PET:
        Pet food, veterinary services and pet supplies.

        RENT:
        Rent or housing payments explicitly identified as rent.

        LOAN_EMI:
        Loan repayments, EMI payments and other explicitly identified debt repayments.

        SALARY:
        Salary, wages or payroll income.

        INVESTMENT:
        Stocks, mutual funds, brokerage, SIPs and other investments.

        EDUCATION:
        Schools, colleges, courses, tuition and educational services.

        TRAVEL:
        Hotels, flights, travel bookings and travel services.

        OTHER:
        Use when the category cannot be reliably determined.

        MERCHANT EXTRACTION:

        Extract the shortest useful merchant or payee name supported by the narration.

        Prefer:
        "ZOMATO" → "Zomato"
        "STARBUCKS PARK STREET" → "Starbucks"
        "AMUL MILK PARLOUR" → "Amul"
        "UBER INDIA" → "Uber"

        Remove:
        - transaction IDs
        - UPI IDs
        - bank codes
        - account numbers
        - reference numbers
        - authorization codes
        - dates and times
        - location details when they are not part of the merchant name

        Do NOT turn a transaction identifier into a merchant.

        If the narration only contains a person's name or an unclear payee,
        preserve that name rather than guessing a business.

        Example:
        "UPI/DR/12345/MR VISHNU/..."
        → merchant: "MR VISHNU"

        Do NOT transform a person's name into a company or business.

        If the narration contains an abbreviated or incomplete merchant name,
        preserve the supported name rather than expanding it from imagination.

        Example:
        "T HUT/YESB/..."
        → merchant may be "T HUT"

        Do NOT invent "The Hut", "Pizza Hut", or another business unless the
        narration itself provides enough evidence.

        IMPORTANT:
        Merchant extraction and merchant identification are different tasks.
        Extract what the narration supports. Do not use outside knowledge to
        invent a more specific merchant.

        DESCRIPTION:

        Write one short sentence describing the transaction.
        Maximum 20 words.
        Base it only on information present in the narration.

        Examples:
        "UPI payment to Zomato"
        "Card purchase at Starbucks"
        "Fuel purchase"
        "Salary credit"
        "Payment to MR VISHNU"

        CONFIDENCE:

        Confidence measures how strongly the narration supports BOTH the
        extracted merchant and category.

        0.90 - 1.00:
        Merchant and category are explicitly clear.

        0.70 - 0.89:
        Merchant and category are strongly supported but one element has
        some ambiguity.

        0.40 - 0.69:
        A reasonable interpretation exists but important information is missing.

        0.00 - 0.39:
        Merchant or category is unclear. Prefer OTHER rather than guessing.

        Never increase confidence merely because a merchant name looks familiar.

        FINAL RULE:

        When evidence is insufficient, choose OTHER and lower confidence.
        A conservative result is better than an invented merchant or category.
        """;

    private static final String SINGLE_OUTPUT_FORMAT = """
        Return exactly one JSON object.

        JSON schema:
        {
          "category": "<one allowed category>",
          "confidence": <number from 0.0 to 1.0>,
          "merchant": "<extracted merchant or payee>",
          "description": "<short description>"
        }

        Requirements:
        - category MUST be exactly one value from the allowed category list.
        - confidence MUST be between 0.0 and 1.0.
        - merchant MUST contain only the extracted merchant/payee name.
        - description MUST be at most 20 words.
        - Do not add fields.
        - Do not omit fields.
        - Do not add markdown.
        - Do not add explanations.
        - Do not repeat the input narration.

        Example:
        {"category":"FOOD_DINING","confidence":0.96,"merchant":"Zomato","description":"UPI payment to Zomato"}
        """;

    private static final String BATCH_OUTPUT_FORMAT = """
        The user message contains multiple numbered transactions.

        Process each transaction independently.

        Return exactly one JSON result for every input transaction.

        Preserve the input order exactly.

        If the input contains:
        1. transaction A
        2. transaction B
        3. transaction C

        then the output MUST contain:
        results[0] = transaction A
        results[1] = transaction B
        results[2] = transaction C

        Never:
        - skip an item
        - merge items
        - split an item
        - duplicate an item
        - reorder items
        - invent an additional item

        OUTPUT:

        {
          "results": [
            {
              "category": "<allowed category>",
              "confidence": <0.0 to 1.0>,
              "merchant": "<merchant or payee>",
              "description": "<short description>"
            }
          ]
        }

        Every result MUST contain exactly these four fields:
        category, confidence, merchant, description.

        If the transaction is unclear:
        - category = "OTHER"
        - confidence <= 0.39
        - merchant = the clearest payee/name visible in the narration
        - do not invent a business name

        If the transaction is clearly a clean transaction that does not require
        merchant extraction, still return all four fields. Use null for merchant
        and description only when the input explicitly indicates that no merchant
        information is available.

        Return JSON only.
        No markdown.
        No explanations.
        No additional text.
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
