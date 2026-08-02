package com.solara.insightservice.repository;

import com.solara.insightservice.dto.request.SimilarCategorization;
import com.solara.insightservice.model.MerchantProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MerchantProfileRepository extends JpaRepository<MerchantProfile, UUID> {

    @Query(value = """
        SELECT merchant, category, description FROM merchant_profiles
        WHERE user_id = :userId
          AND 1 - (embedding <=> CAST(:embedding AS vector)) >= :minSimilarity
        ORDER BY embedding <=> CAST(:embedding AS vector)
        LIMIT :limit
        """, nativeQuery = true)
    List<SimilarCategorization> findNearest(@Param("userId") UUID userId,
                                            @Param("embedding") String embedding,
                                            @Param("limit") int limit,
                                            @Param("minSimilarity") double minSimilarity);

    @Modifying
    @Query(value = """
        INSERT INTO merchant_profiles (id, user_id, merchant, normalized_merchant, description, category, embedding, updated_at)
        VALUES (gen_random_uuid(), :userId, :merchant, :normalizedMerchant, :description, :category,
                CAST(:embedding AS vector), now())
        ON CONFLICT (user_id, normalized_merchant)
        DO UPDATE SET merchant = EXCLUDED.merchant,
                      description = EXCLUDED.description,
                      category = EXCLUDED.category,
                      embedding = EXCLUDED.embedding,
                      updated_at = now()
        """, nativeQuery = true)
    void upsert(@Param("userId") UUID userId,
                @Param("merchant") String merchant,
                @Param("normalizedMerchant") String normalizedMerchant,
                @Param("description") String description,
                @Param("category") String category,
                @Param("embedding") String embedding);

    long countByUserId(UUID userId);

    Optional<MerchantProfile> findByUserIdAndNormalizedMerchant(UUID userId, String normalizedMerchant);

    @Modifying
    @Query(value = """
        DELETE FROM merchant_profiles
        WHERE user_id = :userId AND normalized_merchant = :normalizedMerchant
        """, nativeQuery = true)
    void deleteByUserIdAndNormalizedMerchant(@Param("userId") UUID userId,
                                             @Param("normalizedMerchant") String normalizedMerchant);

}
