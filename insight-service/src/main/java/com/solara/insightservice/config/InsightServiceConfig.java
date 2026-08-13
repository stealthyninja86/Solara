package com.solara.insightservice.config;

import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import org.apache.kafka.clients.admin.NewTopic;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
public class InsightServiceConfig {

    private static final Logger log = LoggerFactory.getLogger(InsightServiceConfig.class);

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, String> kafkaListenerContainerFactory(
            ConsumerFactory<String, String> consumerFactory) {
        ConcurrentKafkaListenerContainerFactory<String, String> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.MANUAL);
        factory.getContainerProperties().setObservationEnabled(true);
        log.info("Kafka listener container factory initialized with AckMode={}, observationEnabled={}",
                ContainerProperties.AckMode.MANUAL, true);
        return factory;
    }

    @Bean
    public ObjectMapper objectMapper() {
        log.debug("ObjectMapper bean created (findAndAddModules, java8 time handlers not required)");
        return JsonMapper.builder()
                .disable(MapperFeature.REQUIRE_HANDLERS_FOR_JAVA8_TIMES)
                .findAndAddModules()
                .build();
    }

    @Bean
    public NewTopic categorizedTopic() {
        NewTopic topic = TopicBuilder.name("transaction.categorized.v1")
                .partitions(3)
                .replicas(1)
                .build();
        log.info("Topic bean declared: name={}, partitions={}, replicas={}",
                "transaction.categorized.v1", 3, 1);
        return topic;
    }
}
