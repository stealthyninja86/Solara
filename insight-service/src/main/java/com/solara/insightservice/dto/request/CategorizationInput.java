package com.solara.insightservice.dto.request;

import com.solara.insightservice.dto.internal.RAGContext;
import com.solara.insightservice.dto.internal.SimilarCategorization;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CategorizationInput(
    String merchant,
    String normalizedMerchant,
    String description,
    BigDecimal amount,
    UUID userId,
    boolean isBulkImport,
    List<SimilarCategorization> examples,
    RAGContext ragContext
) {

    public CategorizationInput(String merchant, String normalizedMerchant, String description,
                               BigDecimal amount, UUID userId, boolean isBulkImport) {
        this(merchant, normalizedMerchant, description, amount, userId, isBulkImport, List.of(), null);
    }

    public CategorizationInput withExamples(List<SimilarCategorization> examples) {
        return new CategorizationInput(
                merchant, normalizedMerchant, description, amount, userId, isBulkImport, examples, ragContext);
    }

    public CategorizationInput withRAGContext(RAGContext ragContext) {
        return new CategorizationInput(
                merchant, normalizedMerchant, description, amount, userId, isBulkImport, examples, ragContext);
    }
}
