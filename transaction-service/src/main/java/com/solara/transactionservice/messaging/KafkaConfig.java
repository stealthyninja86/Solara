package com.solara.transactionservice.messaging;

import org.apache.kafka.clients.admin.NewTopic;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfig {

    private static final Logger log = LoggerFactory.getLogger(KafkaConfig.class);

    @Bean
    public NewTopic transactionEventTopic() {
        log.info("Topic bean declared: name={}, partitions={}, replicas={}", "transaction.events", 3, 1);
        return TopicBuilder.name("transaction.events")
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic transactionEventsDlq() {
        log.info("Topic bean declared: name={}, partitions={}, replicas={}", "transaction.events.dlq", 1, 1);
        return TopicBuilder.name("transaction.events.dlq")
                .partitions(1)
                .replicas(1)
                .build();
    }
}
