package com.solara.insightservice.service.strategy.categorization;

import com.solara.insightservice.dto.request.SimilarCategorization;
import com.solara.insightservice.repository.MerchantProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

@Component
public class RAGContextRetriever {

    private static final Logger log = LoggerFactory.getLogger(RAGContextRetriever.class);

    private final MerchantProfileRepository merchantProfileRepository;
    private final EmbeddingModel embeddingModel;

    @Value("${app.rag.min-history:30}")
    private int minHistory;

    @Value("${app.rag.limit:5}")
    private int limit;

    @Value("${app.rag.min-similarity:0.60}")
    private double minSimilarity;

    public RAGContextRetriever(MerchantProfileRepository merchantProfileRepository,
                               EmbeddingModel embeddingModel) {
        this.merchantProfileRepository = merchantProfileRepository;
        this.embeddingModel = embeddingModel;
    }

    public List<SimilarCategorization> findSimilar(UUID userId, String merchant, String normalizedMerchant,
                                                   boolean isBulkImport) {
        try {
            if (merchantProfileRepository.countByUserId(userId) < minHistory) {
                return List.of();
            }
            String queryText = isBulkImport ? merchant : normalizedMerchant;
            float[] queryEmbedding = embeddingModel.embed(queryText);
            return merchantProfileRepository.findNearest(userId, toVectorLiteral(queryEmbedding), limit, minSimilarity);
        } catch (Exception e) {
            log.warn("RAG retrieval failed for userId={}, merchant={}: {}",
                    userId, merchant, e.getMessage());
            return List.of();
        }
    }

    private String toVectorLiteral(float[] values) {
        StringBuilder builder = new StringBuilder("[");
        for (int i = 0; i < values.length; i++) {
            if (i > 0) builder.append(",");
            builder.append(values[i]);
        }
        return builder.append("]").toString();
    }
}
