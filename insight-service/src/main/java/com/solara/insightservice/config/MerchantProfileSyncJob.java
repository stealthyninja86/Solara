package com.solara.insightservice.config;

import com.solara.insightservice.model.TransactionCategory;
import com.solara.insightservice.repository.MerchantProfileRepository;
import com.solara.insightservice.util.VectorLiterals;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@ConditionalOnProperty(name = "app.merchant-profile.sync-enabled", havingValue = "true", matchIfMissing = true)
public class MerchantProfileSyncJob {

    private static final Logger log = LoggerFactory.getLogger(MerchantProfileSyncJob.class);

    private final JdbcTemplate jdbcTemplate;
    private final MerchantProfileRepository merchantProfileRepository;
    private final EmbeddingModel embeddingModel;

    public MerchantProfileSyncJob(JdbcTemplate jdbcTemplate,
                                  MerchantProfileRepository merchantProfileRepository,
                                  EmbeddingModel embeddingModel) {
        this.jdbcTemplate = jdbcTemplate;
        this.merchantProfileRepository = merchantProfileRepository;
        this.embeddingModel = embeddingModel;
    }

    @Scheduled(fixedDelayString = "${app.merchant-profile.sync-interval-ms:21600000}",
            initialDelayString = "${app.merchant-profile.sync-initial-delay-ms:60000}")
    @Transactional
    public void run() {
        ensureHnswIndex();
        rebuildProfilesFromSourceOfTruth();
        deleteOrphanProfiles();
    }

    private void ensureHnswIndex() {
        try {
            jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_merchant_profiles_hnsw
                ON merchant_profiles USING hnsw (embedding vector_cosine_ops)
                """);
            log.info("HNSW index on merchant_profiles ready");
        } catch (Exception e) {
            log.warn("Could not create HNSW index (is pgvector installed?): {}", e.getMessage());
        }
    }

    private void rebuildProfilesFromSourceOfTruth() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
            SELECT DISTINCT ON (user_id, normalized_merchant)
                   user_id, merchant, normalized_merchant, original_description AS description, category
            FROM categorized_transactions
            WHERE needs_review = false
              AND category IS NOT NULL
              AND normalized_merchant IS NOT NULL
              AND (confidence >= 0.70 OR confidence IS NULL)
            ORDER BY user_id, normalized_merchant, created_at DESC
            """);

        if (rows.isEmpty()) {
            log.info("Profile store sync: no eligible categorizations found");
            return;
        }

        int upserted = 0;
        int skipped = 0;
        for (Map<String, Object> row : rows) {
            UUID userId = row.get("user_id") instanceof UUID uuid
                    ? uuid : UUID.fromString(String.valueOf(row.get("user_id")));
            String merchant = (String) row.get("merchant");
            String normalizedMerchant = (String) row.get("normalized_merchant");
            String description = (String) row.get("description");
            String categoryValue = (String) row.get("category");

            TransactionCategory category;
            try {
                category = TransactionCategory.valueOf(categoryValue);
            } catch (IllegalArgumentException e) {
                skipped++;
                continue;
            }
            try {
                String embedText = merchant
                        + (description != null ? " " + description : "");
                float[] embedding = embeddingModel.embed(embedText);
                merchantProfileRepository.upsert(
                        userId, merchant, normalizedMerchant,
                        description, category.name(), VectorLiterals.toPostgresLiteral(embedding));
                upserted++;
            } catch (Exception e) {
                skipped++;
                log.warn("Profile store sync failed for merchant={}: {}",
                        merchant, e.getMessage());
            }
        }
        log.info("Profile store sync: {} profiles upserted, {} skipped", upserted, skipped);
    }

    private void deleteOrphanProfiles() {
        int deleted = jdbcTemplate.update("""
            DELETE FROM merchant_profiles p
            WHERE NOT EXISTS (
                SELECT 1 FROM categorized_transactions t
                WHERE t.user_id = p.user_id
                  AND t.normalized_merchant = p.normalized_merchant
                  AND t.needs_review = false
                  AND t.category IS NOT NULL
            )
            """);
        if (deleted > 0) {
            log.info("Profile store sync: deleted {} orphan profiles", deleted);
        }
    }
}
