package com.solara.insightservice.service;

import com.solara.insightservice.dto.response.InsightTextResponse;
import com.solara.insightservice.dto.response.InsightCardResponse;
import com.solara.insightservice.dto.response.InsightFact;
import com.solara.insightservice.metrics.InsightPipeMetrics;
import com.solara.insightservice.model.InsightQuestion;
import com.solara.insightservice.model.ReportPeriod;
import com.solara.insightservice.service.strategy.insight.InsightTextWriter;
import com.solara.insightservice.service.strategy.insight.InsightValidator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * The shared insight engine behind BOTH surfaces (Overview and
 * Recommendations) — named Insight* because it has shared responsibility:
 * {@link #feed} is the one card pipeline both surface services consume, so the
 * two can never disagree.
 *
 * <p>The scheduler-less core: facts → rank → limit → generate → cache. The
 * whole "ranking" is one hand-written comparator — over-budget alarms outrank
 * anomalies, which outrank upcoming charges, which outrank status cards (UX
 * contract §17).</p>
 *
 * <p>Card text is LLM-only: facts whose text came back {@code null} (LLM off,
 * unavailable, rejected, or slow) are dropped, and the feed is never cached
 * empty — an empty feed means "AI could not write cards right now", and
 * caching that for 24h would keep the section hidden long after Ollama
 * recovered.</p>
 */
@Service
public class InsightGenerator {

    private static final Logger log = LoggerFactory.getLogger(InsightGenerator.class);

    private static final int FEED_SIZE = 5;
    private static final Duration JOIN_TIMEOUT = Duration.ofSeconds(30);

    private final ReportService reportService;
    private final InsightFeedCache cache;
    private final InsightValidator validator;
    private final InsightTextWriter textWriter;
    private final InsightPipeMetrics metrics;

    public InsightGenerator(ReportService reportService,
                            InsightFeedCache cache,
                            InsightValidator validator,
                            InsightTextWriter textWriter,
                            InsightPipeMetrics metrics) {
        this.reportService = reportService;
        this.cache = cache;
        this.validator = validator;
        this.textWriter = textWriter;
        this.metrics = metrics;
    }

    public List<InsightCardResponse> feed(UUID userId, ReportPeriod period, LocalDate at,
                                          boolean llmEnabled) {
        long start = System.currentTimeMillis();
        List<InsightCardResponse> cached = cache.get(userId, period, at);
        if (cached != null) {
            log.debug("Insights cache hit: userId={}, period={}, at={}, cards={}",
                    userId, period, at, cached.size());
            return cached;
        }
        List<InsightCardResponse> cards = reportService.buildFacts(userId, period, at).stream()
                .sorted(byImpact())
                .limit(FEED_SIZE)
                .map(fact -> new InsightCardResponse(
                        fact.id(),
                        fact.question(),
                        fact.label(),
                        generate(llmEnabled, fact),
                        fact.value(),
                        fact.changePercent(),
                        null))
                .filter(card -> card.text() != null)
                .toList();
        if (!cards.isEmpty()) {
            cache.put(userId, period, at, cards);
        } else {
            log.debug("Feed empty — not cached (LLM unavailable or disabled): userId={}, period={}, at={}",
                    userId, period, at);
        }
        log.debug("Insights generated: userId={}, period={}, at={}, cards={}, durationMs={}",
                userId, period, at, cards.size(), System.currentTimeMillis() - start);
        return cards;
    }

    public boolean isLlmAvailable() {
        return textWriter.isAvailable();
    }

    private InsightTextResponse generate(boolean llmEnabled, InsightFact fact) {
        if (!llmEnabled) {
            metrics.generationDropped();
            return null;
        }
        metrics.generationTotal();
        long start = System.currentTimeMillis();
        InsightTextResponse attempt = await(textWriter.write(fact));
        if (attempt != null && validator.validate(attempt, fact)) {
            metrics.generationValid();
            log.debug("LLM card text accepted: fact={}, durationMs={}",
                    fact.id(), System.currentTimeMillis() - start);
            return attempt;
        }
        metrics.generationDropped();
        log.warn("Card text rejected or LLM unavailable — card dropped: fact={}", fact.id());
        return null;
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
            if (fact.question() == InsightQuestion.ACTION && fact.id().startsWith("over_")) return 0;
            if (fact.question() == InsightQuestion.ACTION) return 1;
            if (fact.question() == InsightQuestion.NEXT) return 2;
            return 3;                                                   // STATUS
        });
    }
}
