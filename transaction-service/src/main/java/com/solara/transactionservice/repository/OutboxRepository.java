package com.solara.transactionservice.repository;


import com.solara.transactionservice.outbox.OutboxEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.List;
import java.util.UUID;

public interface OutboxRepository extends JpaRepository<OutboxEntity, UUID> {
    List<OutboxEntity> findByPublishedAtIsNullOrderByCreatedAtAsc();
}
