package com.solara.insightservice.metrics;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

@Component
public class InsightPipeMetrics {

    private final Counter generationTotal;
    private final Counter generationValid;
    private final Counter generationRetry;
    private final Counter generationDropped;
    private final Counter generationTimeout;
    private final Counter recommendationViewed;

    public InsightPipeMetrics(MeterRegistry meterRegistry) {
        this.generationTotal = meterRegistry.counter("insight_generation_total",
                "pipeline", "overview");
        this.generationValid = meterRegistry.counter("insight_generation_valid",
                "pipeline", "overview");
        this.generationRetry = meterRegistry.counter("insight_generation_retry",
                "pipeline", "overview");
        this.generationDropped = meterRegistry.counter("insight_generation_dropped",
                "pipeline", "overview");
        this.generationTimeout = meterRegistry.counter("insight_generation_timeout",
                "pipeline", "overview");
        this.recommendationViewed = meterRegistry.counter("insight_recommendation_viewed",
                "pipeline", "overview");
    }

    public void generationTotal() {
        generationTotal.increment();
    }

    public void generationValid() {
        generationValid.increment();
    }

    public void generationRetried() {
        generationRetry.increment();
    }

    public void generationDropped() {
        generationDropped.increment();
    }

    public void generationTimeout() {
        generationTimeout.increment();
    }

    public void recommendationViewed() {
        recommendationViewed.increment();
    }
}