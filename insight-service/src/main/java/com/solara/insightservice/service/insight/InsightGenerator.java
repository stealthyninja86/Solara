package com.solara.insightservice.service.insight;

import com.solara.insightservice.config.TracedExecutors;
import com.solara.insightservice.dto.response.InsightCardResponse;
import com.solara.insightservice.dto.response.InsightFact;
import com.solara.insightservice.dto.response.InsightTextResponse;
import com.solara.insightservice.metrics.InsightPipeMetrics;
import com.solara.insightservice.model.CardRejectionReason;
import com.solara.insightservice.model.InsightType;
import com.solara.insightservice.model.ReportPeriod;
import com.solara.insightservice.service.report.ReportService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Service
public class InsightGenerator {

    private static final Logger log = LoggerFactory.getLogger(InsightGenerator.class);

    private static final int FEED_SIZE = 5;
    private static final Duration JOIN_TIMEOUT = Duration.ofSeconds(30);

    private static final InsightTextResponse ERROR_TEXT = new InsightTextResponse(
            "This insight didn't load",
            "Something went wrong while writing it. Try refreshing in a moment.",
            "Pull to refresh to try again.");

    private final ReportService reportService;
    private final InsightFeedCache cache;
    private final InsightValidator validator;
    private final InsightTextWriter textWriter;
    private final InsightPipeMetrics metrics;
    private final boolean aiEnabled;
    private final Executor generationExecutor;
    private final Map<String, Boolean> generationsInFlight = new ConcurrentHashMap<>();

    public InsightGenerator(ReportService reportService,
                            InsightFeedCache cache,
                            InsightValidator validator,
                            InsightTextWriter textWriter,
                            InsightPipeMetrics metrics,
                            @Value("${app.ai.enabled:true}") boolean aiEnabled) {
        this.reportService = reportService;
        this.cache = cache;
        this.validator = validator;
        this.textWriter = textWriter;
        this.metrics = metrics;
        this.aiEnabled = aiEnabled;
        this.generationExecutor = TracedExecutors.decorated(Executors.newThreadPerTaskExecutor(
                Thread.ofVirtual().name("insight-generation-", 0).factory()));
    }

    public List<InsightCardResponse> feed(UUID userId, ReportPeriod period, LocalDate at,
                                          boolean llmEnabled, Set<InsightType> types) {
        return feed(userId, period, at, llmEnabled, types, false);
    }

    public List<InsightCardResponse> feed(UUID userId, ReportPeriod period, LocalDate at,
                                          boolean llmEnabled, Set<InsightType> types, boolean force) {
        if (!force) {
            List<InsightCardResponse> cached = cache.get(userId, period, at, types);
            if (cached != null) {
                log.debug("Insights cache hit: userId={}, period={}, at={}, types={}, cards={}",
                        userId, period, at, InsightType.cacheSuffix(types), cached.size());
                return cached;
            }
        }
        if (!llmEnabled || !aiEnabled) {
            log.debug("Feed empty — not cached (LLM unavailable or disabled): userId={}, period={}, at={}, types={}",
                    userId, period, at, InsightType.cacheSuffix(types));
            return List.of();
        }
        String generationKey = generationKey(userId, period, at, types);
        if (generationsInFlight.putIfAbsent(generationKey, Boolean.TRUE) != null) {
            log.info("Insight generation already in flight — returning empty: userId={}, period={}, at={}, types={}",
                    userId, period, at, InsightType.cacheSuffix(types));
            return List.of();
        }
        if (force) {
            cache.evict(userId, period, at, types);
            log.info("Insights cache evicted for forced regeneration: userId={}, period={}, at={}, types={}",
                    userId, period, at, InsightType.cacheSuffix(types));
        }
        log.info("Insights cache miss — scheduling background generation: userId={}, period={}, at={}, types={}, force={}",
                userId, period, at, InsightType.cacheSuffix(types), force);
        long scheduledAt = System.currentTimeMillis();
        generationExecutor.execute(() -> {
            try {
                generateAndCache(userId, period, at, types);
            } finally {
                generationsInFlight.remove(generationKey);
            }
            log.info("Background insight generation completed: userId={}, period={}, at={}, types={}, durationMs={}",
                    userId, period, at, InsightType.cacheSuffix(types),
                    System.currentTimeMillis() - scheduledAt);
        });
        return List.of();
    }

    private void generateAndCache(UUID userId, ReportPeriod period, LocalDate at, Set<InsightType> types) {
        long start = System.currentTimeMillis();
        List<InsightCardResponse> cards = reportService.buildFacts(userId, period, at).stream()
                .filter(fact -> types.contains(fact.type()))
                .sorted(byImpact())
                .limit(FEED_SIZE)
                .map(fact -> {
                    InsightTextResponse text = generate(true, fact);
                    if (text == null) return null;
                    return buildCard(fact, text);
                })
                .filter(java.util.Objects::nonNull)
                .toList();
        if (!cards.isEmpty()) {
            cache.put(userId, period, at, types, cards);
        } else {
            log.debug("Feed empty — not cached (LLM unavailable or disabled): userId={}, period={}, at={}, types={}",
                    userId, period, at, InsightType.cacheSuffix(types));
        }
        long failed = cards.stream().filter(card -> card.retryAfterSeconds() != null).count();
        log.info("Insight generation finished: userId={}, period={}, at={}, types={}, cards={}, failed={}, cached={}, durationMs={}",
                userId, period, at, InsightType.cacheSuffix(types), cards.size(), failed,
                !cards.isEmpty(), System.currentTimeMillis() - start);
    }

    private String generationKey(UUID userId, ReportPeriod period, LocalDate at, Set<InsightType> types) {
        return userId + ":" + period + ":" + at + ":" + InsightType.cacheSuffix(types);
    }

    public boolean isLlmAvailable() {
        return textWriter.isAvailable();
    }

    private InsightTextResponse generate(boolean llmEnabled, InsightFact fact) {
        if (!llmEnabled || !aiEnabled) {
            metrics.generationDropped();
            return null;
        }
        metrics.generationTotal();
        long start = System.currentTimeMillis();
        InsightTextResponse attempt = await(textWriter.write(fact));
        if (attempt == null) {
            metrics.generationDropped();
            log.warn("Card text unavailable (slow or circuit-open) — error card shown: fact={}", fact.id());
            return ERROR_TEXT;
        }
        var rejection = validator.validate(attempt, fact);
        if (rejection.isEmpty()) {
            metrics.generationValid();
            log.debug("LLM card text accepted: fact={}, durationMs={}",
                    fact.id(), System.currentTimeMillis() - start);
            return attempt;
        }
        // One corrective re-prompt with the exact failure before giving up —
        // qwen3 models frequently write bare numbers, which is a prompt
        // miss, not a model failure.
        metrics.generationRetried();
        log.warn("Card text rejected ({}), re-prompting: fact={}", rejection.get(), fact.id());
        String correctiveHint = rejection.get() == CardRejectionReason.LENGTH_EXCEEDED
                ? "length check failed: " + validator.lengthViolations(attempt, fact)
                : rejection.get().correctiveHint();
        InsightTextResponse corrected = await(textWriter.writeCorrected(fact, correctiveHint));
        if (corrected != null && validator.validate(corrected, fact).isEmpty()) {
            metrics.generationValid();
            log.debug("LLM card text accepted after re-prompt: fact={}, durationMs={}",
                    fact.id(), System.currentTimeMillis() - start);
            return corrected;
        }
        metrics.generationDropped();
        log.warn("Card text rejected after re-prompt — error card shown: fact={}", fact.id());
        return ERROR_TEXT;
    }

    private InsightCardResponse buildCard(InsightFact fact, InsightTextResponse text) {
        boolean failed = text == ERROR_TEXT;
        return new InsightCardResponse(
                fact.id(),
                fact.type(),
                fact.label(),
                renderTokens(fact, text),
                failed ? null : fact.value(),
                failed ? null : fact.changePercent(),
                null,
                failed ? InsightFeedCache.FAILED_CARD_TTL_SECONDS : null);
    }

    private InsightTextResponse renderTokens(InsightFact fact, InsightTextResponse text) {
        return new InsightTextResponse(
                fact.renderTokens(text.headline()),
                fact.renderTokens(text.body()),
                fact.renderTokens(text.suggestion()));
    }

    private InsightTextResponse await(CompletableFuture<InsightTextResponse> future) {
        try {
            return future.get(JOIN_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException | ExecutionException | TimeoutException e) {
            log.warn("Card-text join failed: {}", e.getMessage());
            return null;
        }
    }

    private Comparator<InsightFact> byImpact() {
        return Comparator.comparingInt(fact -> {
            if (fact.type() == InsightType.ACTION && fact.id().startsWith("over_")) return 0;
            if (fact.type() == InsightType.ACTION) return 1;
            if (fact.type() == InsightType.NEXT) return 2;
            return 3;                                                   // STATUS
        });
    }
}
