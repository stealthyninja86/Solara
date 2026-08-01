package com.solara.insightservice.repository;

import com.solara.insightservice.model.Projection;
import com.solara.insightservice.model.TransactionCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProjectionRepository extends JpaRepository<Projection, UUID> {

    @Modifying
    @Query(value = """
        INSERT INTO projections (id, user_id, category, period, period_start, transaction_type,
                                  total_amount, transaction_count, created_at, updated_at)
        VALUES (:id, :userId, :category, :period, :periodStart, :transactionType,
                :amount, 1, NOW(), NOW())
        ON CONFLICT (user_id, category, period, period_start, transaction_type)
        DO UPDATE SET
            total_amount = projections.total_amount + :amount,
            transaction_count = projections.transaction_count + 1,
            updated_at = NOW()
        """, nativeQuery = true)
    void upsert(@Param("id") UUID id, @Param("userId") UUID userId,
                @Param("category") String category, @Param("period") String period,
                @Param("periodStart") LocalDate periodStart,
                @Param("transactionType") String transactionType,
                @Param("amount") BigDecimal amount);

    List<Projection> findByUserIdAndPeriodAndPeriodStartBetween(
            UUID userId, String period, LocalDate start, LocalDate end);

    Optional<Projection> findByUserIdAndCategoryAndPeriodAndPeriodStart(
            UUID userId, TransactionCategory category, String period, LocalDate periodStart);

    void deleteByUserId(UUID userId);

    @Query(value = "SELECT COALESCE(SUM(total_amount), 0) FROM projections WHERE user_id = :userId AND period_start = :periodStart AND period = 'MONTHLY' AND transaction_type = 'DEBIT'", nativeQuery = true)
    BigDecimal sumTotalAmountByPeriod(@Param("userId") UUID userId,
                                       @Param("periodStart") LocalDate periodStart);

    @Query(value = "SELECT monthly_budget FROM projections WHERE user_id = :userId AND period_start = :periodStart AND monthly_budget IS NOT NULL LIMIT 1", nativeQuery = true)
    Optional<BigDecimal> findMonthlyBudget(@Param("userId") UUID userId,
                                            @Param("periodStart") LocalDate periodStart);

    @Modifying
    @Query(value = """
        INSERT INTO projections (id, user_id, category, period, period_start, transaction_type,
                                 total_amount, transaction_count, monthly_budget, created_at, updated_at)
        VALUES (:id, :userId, 'BUDGET', 'MONTHLY', :periodStart, 'BUDGET', 0, 0, :budget, NOW(), NOW())
        ON CONFLICT (user_id, category, period, period_start, transaction_type)
        DO UPDATE SET monthly_budget = :budget, updated_at = NOW()
        """, nativeQuery = true)
    void upsertBudget(@Param("id") UUID id, @Param("userId") UUID userId,
                      @Param("periodStart") LocalDate periodStart,
                      @Param("budget") BigDecimal budget);
}
