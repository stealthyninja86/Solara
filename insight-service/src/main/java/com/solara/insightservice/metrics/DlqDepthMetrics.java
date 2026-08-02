package com.solara.insightservice.metrics;

import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PreDestroy;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.ListOffsetsResult;
import org.apache.kafka.clients.admin.OffsetSpec;
import org.apache.kafka.common.TopicPartition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Exposes the dead-letter-topic backlog as a gauge. The DLQ has no consumer
 * group, so depth is end offset - beginning offset. A growing DLQ is an
 * application-level failure signal (poison messages or a broken retry chain),
 * so it must be a first-class metric, not a log line.
 */
@Component
public class DlqDepthMetrics {

    private static final Logger log = LoggerFactory.getLogger(DlqDepthMetrics.class);

    private static final String DLQ_TOPIC = "transaction.events.dlq";
    private static final TopicPartition DLQ_PARTITION = new TopicPartition(DLQ_TOPIC, 0);

    private final AdminClient adminClient;
    private final AtomicLong dlqDepth = new AtomicLong(0);

    public DlqDepthMetrics(KafkaAdmin kafkaAdmin, MeterRegistry meterRegistry) {
        this.adminClient = AdminClient.create(kafkaAdmin.getConfigurationProperties());
        meterRegistry.gauge("solara.dlq.depth", dlqDepth);
    }

    @PreDestroy
    public void close() {
        adminClient.close(Duration.ofSeconds(5));
    }

    @Scheduled(
            fixedDelayString = "${app.metrics.dlq-depth-interval-ms:60000}",
            initialDelayString = "${app.metrics.dlq-depth-initial-delay-ms:30000}")
    public void updateDlqDepth() {
        try {
            ListOffsetsResult earliestResult =
                    adminClient.listOffsets(Map.of(DLQ_PARTITION, OffsetSpec.earliest()));
            ListOffsetsResult latestResult =
                    adminClient.listOffsets(Map.of(DLQ_PARTITION, OffsetSpec.latest()));

            Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> earliest =
                    earliestResult.all().get(5, java.util.concurrent.TimeUnit.SECONDS);
            Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> latest =
                    latestResult.all().get(5, java.util.concurrent.TimeUnit.SECONDS);

            long earliestOffset = earliest.get(DLQ_PARTITION).offset();
            long latestOffset = latest.get(DLQ_PARTITION).offset();
            dlqDepth.set(Math.max(0, latestOffset - earliestOffset));
        } catch (Exception e) {
            log.warn("Failed to read DLQ depth for {}: {}", DLQ_TOPIC, e.getMessage());
        }
    }
}
