package com.solara.insightservice.repository;

import com.solara.insightservice.model.Subscription;
import com.solara.insightservice.model.SubscriptionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SubscriptionRepository extends JpaRepository<Subscription, UUID> {

    List<Subscription> findByUserIdOrderByStatusAscNextExpectedDateAsc(UUID userId);

    Optional<Subscription> findByUserIdAndId(UUID userId, UUID id);

    List<Subscription> findByUserIdAndStatus(UUID userId, SubscriptionStatus status);

    List<Subscription> findByUserIdAndNormalizedMerchantAndStatus(
            UUID userId, String normalizedMerchant, SubscriptionStatus status);

    List<Subscription> findByUserIdAndPayeeMerchantAndStatus(
            UUID userId, String payeeMerchant, SubscriptionStatus status);
}