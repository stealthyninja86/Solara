package com.solara.insightservice.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.support.ContextPropagatingTaskDecorator;

/**
 * Re-propagates trace/observation context across virtual-thread boundaries.
 *
 * <p>Virtual threads do not inherit thread-locals from the submitting thread, so
 * without this decorator every span started on a platform thread (Kafka consumer,
 * scheduler) dies the moment work hops onto an executor's virtual threads — the
 * 10-30s LLM span would be orphaned. Spring Boot auto-applies the decorator to
 * its own executors when the bean is present; custom executors that run LLM work
 * must add the same decoration explicitly.
 */
@Configuration
public class TracingConfig {

    @Bean
    public ContextPropagatingTaskDecorator contextPropagatingTaskDecorator() {
        return new ContextPropagatingTaskDecorator();
    }
}
