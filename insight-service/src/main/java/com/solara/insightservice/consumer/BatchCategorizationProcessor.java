package com.solara.insightservice.consumer;

import com.solara.insightservice.dto.AgentResult;
import com.solara.insightservice.service.CacheService;
import com.solara.insightservice.categorization.CategorizationAgent;
import com.solara.insightservice.categorization.CategoryValidator;
import com.solara.insightservice.model.CategorizedTransaction;
import com.solara.insightservice.repository.CategorizedTransactionRepository;
import com.solara.insightservice.service.EmbeddingService;
import com.solara.insightservice.service.ProjectionUpdateService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
public class BatchCategorizationProcessor {

    private static final Logger log = LoggerFactory.getLogger(BatchCategorizationProcessor.class);
    private static final int MAX_ATTEMPTS = 3;
    private static final int BATCH_SIZE = 50;

    private final CategorizedTransactionRepository transactionRepository;
    private final CategorizationAgent agent;
    private final CategoryValidator validator;
    private final CacheService cacheService;
    private final ProjectionUpdateService projectionService;
    private final EmbeddingService embeddingService;
    private final boolean skipAi;

    public BatchCategorizationProcessor(CategorizedTransactionRepository transactionRepository,
                                        CategorizationAgent agent,
                                        CategoryValidator validator,
                                        CacheService cacheService,
                                        ProjectionUpdateService projectionService,
                                        EmbeddingService embeddingService,
                                        @Value("${app.categorization.skip-ai:false}") boolean skipAi) {
        this.transactionRepository = transactionRepository;
        this.agent = agent;
        this.validator = validator;
        this.cacheService = cacheService;
        this.projectionService = projectionService;
        this.embeddingService = embeddingService;
        this.skipAi = skipAi;
    }

    @Scheduled(fixedDelay = 30_000)
    @Transactional
    public void processUncategorized() {
        if (skipAi) {
            return;
        }
        Page<CategorizedTransaction> batch = transactionRepository.findUncategorized(MAX_ATTEMPTS, PageRequest.of(0, BATCH_SIZE));

        if (!batch.hasContent()) return;

        log.info("Processing {} uncategorized transactions", batch.getNumberOfElements());

        List<CategorizedTransaction> transactions = batch.getContent();
        for (CategorizedTransaction transaction : transactions) {
            String normalized = transaction.getNormalizedMerchant();
            if (normalized == null) continue;

            AgentResult cached = cacheService.get(normalized, transaction.getUserId());
            if (cached != null) {
                applyCategory(transaction, cached);
                transactionRepository.save(transaction);
                continue;
            }

            AgentResult result = agent.categorize(normalized, transaction.getOriginalDescription(), transaction.getAmount(), transaction.getUserId());
            result = validator.validate(result);

            if (result != null && result.category() != null) {
                applyCategory(transaction, result);
                cacheService.set(normalized, transaction.getUserId(), result);
            } else {
                incrementAttempts(transaction);
            }

            transactionRepository.save(transaction);

            if (transaction.getCategory() != null) {
                projectionService.upsertAll(transaction.getUserId(), transaction.getCategory(),
                        transaction.getAmount(), transaction.getCreatedAt());
                embeddingService.saveEmbedding(transaction);
            }
        }

        log.info("Batch categorization complete: {} processed", transactions.size());
    }

    private void applyCategory(CategorizedTransaction transaction, AgentResult result) {
        transaction.setCategory(result.category());
        transaction.setConfidence(result.confidence());
        transaction.setCategorizationMethod(result.method());
        transaction.setNeedsReview(false);
        if (result.merchant() != null) {
            transaction.setMerchant(result.merchant());
        }
        if (result.description() != null) {
            transaction.setOriginalDescription(result.description());
        }
    }

    private void incrementAttempts(CategorizedTransaction transaction) {
        transaction.setAgentAttempts(transaction.getAgentAttempts() + 1);
        if (transaction.getAgentAttempts() >= MAX_ATTEMPTS) {
            transaction.setAgentFailed(true);
        }
    }
}
