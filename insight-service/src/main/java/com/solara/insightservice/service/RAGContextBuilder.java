package com.solara.insightservice.service;

import com.solara.insightservice.dto.internal.ConsensusStats;
import com.solara.insightservice.dto.internal.RAGContext;
import com.solara.insightservice.dto.internal.SimilarCategorization;
import com.solara.insightservice.model.MerchantKnowledgeBase;
import com.solara.insightservice.repository.MerchantKnowledgeBaseRepository;
import com.solara.insightservice.service.strategy.categorization.RAGContextRetriever;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

@Component
public class RAGContextBuilder {

    private static final Logger log = LoggerFactory.getLogger(RAGContextBuilder.class);

    private final MerchantKnowledgeBaseRepository knowledgeBaseRepository;
    private final RAGContextRetriever ragContextRetriever;
    private final MerchantResolver merchantResolver;

    public RAGContextBuilder(MerchantKnowledgeBaseRepository knowledgeBaseRepository,
                             RAGContextRetriever ragContextRetriever,
                             MerchantResolver merchantResolver) {
        this.knowledgeBaseRepository = knowledgeBaseRepository;
        this.ragContextRetriever = ragContextRetriever;
        this.merchantResolver = merchantResolver;
    }

    public RAGContext build(UUID userId, String merchant, String normalizedMerchant) {
        // Signal 1: User's past categorizations (pgvector)
        List<SimilarCategorization> userHistory =
            ragContextRetriever.findSimilar(userId, merchant, normalizedMerchant, false);

        // Signal 2 + 3: KB category hint + cross-user consensus
        String alias = merchantResolver.normalize(merchant);
        MerchantKnowledgeBase kbHit = knowledgeBaseRepository.findByAlias(alias).orElse(null);

        ConsensusStats stats = null;
        if (kbHit != null) {
            stats = new ConsensusStats(
                kbHit.getCategory(),
                kbHit.getConfidence(),
                kbHit.getTransactionCount()
            );
            log.debug("RAG context: KB hit for merchant='{}', category={}, consensus={} txns",
                    merchant, kbHit.getCategory(), kbHit.getTransactionCount());
        }

        return new RAGContext(userHistory, stats);
    }
}
