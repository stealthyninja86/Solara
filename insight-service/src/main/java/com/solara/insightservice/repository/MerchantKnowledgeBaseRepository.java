package com.solara.insightservice.repository;

import com.solara.insightservice.model.MerchantKnowledgeBase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MerchantKnowledgeBaseRepository extends JpaRepository<MerchantKnowledgeBase, UUID> {

    Optional<MerchantKnowledgeBase> findByAlias(String alias);

    List<MerchantKnowledgeBase> findByCanonicalName(String canonicalName);

    @Modifying
    @Transactional
    @Query(value = """
        INSERT INTO merchant_knowledge_base (id, alias, canonical_name, category, confidence, transaction_count, created_at)
        VALUES (gen_random_uuid(), :alias, :canonicalName, :category, :confidence, 1, now())
        ON CONFLICT (alias)
        DO UPDATE SET
            confidence = (merchant_knowledge_base.confidence * merchant_knowledge_base.transaction_count + EXCLUDED.confidence)
                         / (merchant_knowledge_base.transaction_count + 1),
            transaction_count = merchant_knowledge_base.transaction_count + 1
        """, nativeQuery = true)
    void upsert(@Param("alias") String alias,
                @Param("canonicalName") String canonicalName,
                @Param("category") String category,
                @Param("confidence") BigDecimal confidence);
}
