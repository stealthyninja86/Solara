package com.solara.insightservice.repository;

import com.solara.insightservice.model.CategorizedTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.math.BigDecimal;
import java.util.UUID;

@Repository
public interface CategorizedTransactionRepository extends JpaRepository<CategorizedTransaction, UUID>,
        JpaSpecificationExecutor<CategorizedTransaction> {
    @Query("SELECT t FROM CategorizedTransaction t WHERE t.userId = :userId ORDER BY t.createdAt DESC")
    Page<CategorizedTransaction> findByUserId(@Param("userId") UUID userId, Pageable pageable);

    Optional<CategorizedTransaction> findByTransactionIdAndUserId(UUID transactionId, UUID userId);

    @Query("SELECT t FROM CategorizedTransaction t WHERE t.userId = :userId " +
            "AND t.category IS NULL AND t.agentFailed = false AND t.agentAttempts < :maxAttempts")
    Page<CategorizedTransaction> findUncategorizedByUser(@Param("userId") UUID userId,
                                                         @Param("maxAttempts") int maxAttempts, Pageable pageable);

    @Query("SELECT t FROM CategorizedTransaction t WHERE t.category IS NULL " +
            "AND t.agentFailed = false AND t.agentAttempts < :maxAttempts")
    Page<CategorizedTransaction> findUncategorized(@Param("maxAttempts") int maxAttempts, Pageable pageable);

    @Query("SELECT t FROM CategorizedTransaction t WHERE t.userId = :userId AND t.needsReview = true")
    Page<CategorizedTransaction> findNeedsReview(@Param("userId") UUID userId, Pageable pageable);

    @Query("SELECT COUNT(t) FROM CategorizedTransaction t WHERE t.userId = :userId AND t.needsReview = true")
    long countNeedsReview(@Param("userId") UUID userId);

    @Query("SELECT t FROM CategorizedTransaction t WHERE t.userId = :userId " +
            "AND t.normalizedMerchant = :merchant ORDER BY t.createdAt DESC")
    List<CategorizedTransaction> findByUserAndMerchant(@Param("userId") UUID userId,
                                                       @Param("merchant") String normalizedMerchant);

    @Query("SELECT CASE WHEN COUNT(t) > 0 THEN true ELSE false END FROM CategorizedTransaction t " +
            "WHERE t.userId = :userId AND t.normalizedMerchant = :merchant AND t.createdAt > :after")
    boolean existsRecentByUserAndMerchant(@Param("userId") UUID userId,
                                          @Param("merchant") String normalizedMerchant, @Param("after") Instant after);

    @Query(value = """
        SELECT user_id, normalized_merchant
        FROM categorized_transactions
        WHERE created_at >= :since AND normalized_merchant IS NOT NULL
        GROUP BY user_id, normalized_merchant
        HAVING COUNT(*) >= :minCount
        """, nativeQuery = true)
    List<Object[]> findMerchantsWithMinTransactions(
            @Param("since") Instant since, @Param("minCount") int minCount);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM CategorizedTransaction t " +
            "WHERE t.userId = :userId AND t.type = :type " +
            "AND t.createdAt >= :from AND t.createdAt < :to")
    BigDecimal sumAmountByUserAndTypeAndPeriod(@Param("userId") UUID userId,
                                               @Param("type") String type,
                                               @Param("from") Instant from,
                                               @Param("to") Instant to);
}