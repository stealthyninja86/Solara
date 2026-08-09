package com.solara.insightservice.repository;

import com.solara.insightservice.model.BudgetSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BudgetSettingsRepository extends JpaRepository<BudgetSetting, UUID> {

    Optional<BudgetSetting> findByUserIdAndMonthStart(UUID userId, LocalDate monthStart);

    @Modifying
    @Query(value = """
        INSERT INTO budget_settings (id, user_id, month_start, monthly_income, created_at, updated_at)
        VALUES (:id, :userId, :monthStart, :income, NOW(), NOW())
        ON CONFLICT (user_id, month_start)
        DO UPDATE SET monthly_income = :income, updated_at = NOW()
        """, nativeQuery = true)
    void upsertIncome(@Param("id") UUID id, @Param("userId") UUID userId,
                      @Param("monthStart") LocalDate monthStart,
                      @Param("income") BigDecimal income);

    @Modifying
    @Query(value = """
        INSERT INTO budget_settings (id, user_id, month_start, monthly_budget, created_at, updated_at)
        VALUES (:id, :userId, :monthStart, :budget, NOW(), NOW())
        ON CONFLICT (user_id, month_start)
        DO UPDATE SET monthly_budget = :budget, updated_at = NOW()
        """, nativeQuery = true)
    void upsertBudget(@Param("id") UUID id, @Param("userId") UUID userId,
                      @Param("monthStart") LocalDate monthStart,
                      @Param("budget") BigDecimal budget);
}
