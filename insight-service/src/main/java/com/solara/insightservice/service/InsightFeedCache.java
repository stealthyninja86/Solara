package com.solara.insightservice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.solara.insightservice.dto.response.InsightCardResponse;
import com.solara.insightservice.model.ReportPeriod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Lazy cache-aside for the narrated feed, keyed per user + period + anchor
 * ({@code insight:feed:{userId}:{period}:{at}}, TTL 24h ±20% jitter — same
 * stampede story as the merchant cache's {@code agent:cat:*}). No scheduler,
 * no worker, no fingerprint: the only "invalidation" is the TTL.
 *
 * <p>Fail-open in both directions — a corrupt value or a Redis outage both mean
 * "regenerate", never a 500. Caches the <em>cards</em> (post-generation), not
 * the facts: the expensive part is the LLM call, and that's what this skips.</p>
 */
@Component
public class InsightFeedCache {

    private static final Logger log = LoggerFactory.getLogger(InsightFeedCache.class);
    private static final Duration BASE_TTL = Duration.ofHours(24);

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public InsightFeedCache(StringRedisTemplate redis, ObjectMapper objectMapper) {
        this.redis = redis;
        this.objectMapper = objectMapper;
    }

    public List<InsightCardResponse> get(UUID userId, ReportPeriod period, LocalDate at) {
        String value = redis.opsForValue().get(key(userId, period, at));
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.readValue(value, new TypeReference<List<InsightCardResponse>>() {});
        } catch (Exception e) {
            log.warn("Cache read failed for userId={}, period={}: {}", userId, period, e.getMessage());
            return null;                                // fail open → regenerate
        }
    }

    public void put(UUID userId, ReportPeriod period, LocalDate at, List<InsightCardResponse> cards) {
        try {
            redis.opsForValue().set(key(userId, period, at), objectMapper.writeValueAsString(cards),
                    jitteredTtl());
        } catch (Exception e) {
            log.warn("Cache write failed for userId={}, period={}: {}", userId, period, e.getMessage());
        }
    }

    private String key(UUID userId, ReportPeriod period, LocalDate at) {
        return "insight:feed:" + userId + ":" + period + ":" + at;
    }

    private Duration jitteredTtl() {
        long base = BASE_TTL.toSeconds();
        long jitter = ThreadLocalRandom.current().nextLong(-base / 5, base / 5 + 1);
        return Duration.ofSeconds(base + jitter);
    }
}