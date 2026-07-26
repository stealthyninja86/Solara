package com.solara.transactionservice.messaging;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfig {

    @Bean
    public NewTopic transactionEventTopic() {
        return TopicBuilder.name("transaction.events")
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic transactionEventsDlq() {
        return TopicBuilder.name("transaction.events.dlq")
                .partitions(1)
                .replicas(1)
                .build();
    }
}
