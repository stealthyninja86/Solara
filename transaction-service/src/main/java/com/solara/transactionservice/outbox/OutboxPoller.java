package com.solara.transactionservice.outbox;

import com.solara.transactionservice.repository.OutboxRepository;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
public class OutboxPoller {

    private final OutboxRepository outboxRepository;
    private final OutboxPublisherService publisherService;
    private final int batchSize;

    private static final Logger log = LoggerFactory.getLogger(OutboxPoller.class);

    public OutboxPoller(OutboxRepository outboxRepository,
                        OutboxPublisherService publisherService,
                        @Value("${app.outbox.batch-size}") int batchSize) {
        this.outboxRepository = outboxRepository;
        this.publisherService = publisherService;
        this.batchSize = batchSize;
    }

    @Scheduled(fixedDelayString = "${app.outbox.poll-interval-ms}")
    @Transactional
    public void poll() {
        var entries = outboxRepository.findByPublishedAtIsNullOrderByCreatedAtAsc();
        log.debug("Outbox poll found {} unpublished entries", entries.size());
        entries.stream().limit(batchSize).forEach(entry -> {
            try {
                publisherService.publish(entry);
                entry.setPublishedAt(Instant.now());
                outboxRepository.save(entry);
                log.info("Outbox entry published: id={}, aggregateId={}, eventType={}",
                        entry.getId(), entry.getAggregateId(), entry.getEventType());
            } catch (Exception e) {
                log.error("Outbox entry publish failed: id={}, aggregateId={}, eventType={}; will retry on next poll",
                        entry.getId(), entry.getAggregateId(), entry.getEventType(), e);
            }
        });
    }
}