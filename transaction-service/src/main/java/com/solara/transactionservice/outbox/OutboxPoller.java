package com.solara.transactionservice.outbox;

import com.solara.transactionservice.repository.OutboxRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
public class OutboxPoller {

    private final OutboxRepository outboxRepository;
    private final OutboxPublisherService publisherService;
    private final int batchSize;

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
        entries.stream().limit(batchSize).forEach(entry -> {
            try {
                publisherService.publish(entry);
                entry.setPublishedAt(Instant.now());
                outboxRepository.save(entry);
            } catch (Exception e) {
                // log and continue; next poll will retry
            }
        });
    }
}