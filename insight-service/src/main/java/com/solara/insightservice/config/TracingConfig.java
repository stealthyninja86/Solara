package com.solara.insightservice.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.support.ContextPropagatingTaskDecorator;

@Configuration
public class TracingConfig {

    private static final Logger log = LoggerFactory.getLogger(TracingConfig.class);

    @Bean
    public ContextPropagatingTaskDecorator contextPropagatingTaskDecorator() {
        log.info("Trace context propagation across virtual threads enabled");
        return new ContextPropagatingTaskDecorator();
    }
}
