package com.solara.insightservice.service.insight;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.solara.insightservice.dto.response.InsightCardResponse;
import com.solara.insightservice.model.InsightType;
import com.solara.insightservice.model.ReportPeriod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

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

    public List<InsightCardResponse> get(UUID userId, ReportPeriod period, LocalDate at,
                                         Set<InsightType> types) {
        String value = redis.opsForValue().get(key(userId, period, at, types));
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

    public void put(UUID userId, ReportPeriod period, LocalDate at, Set<InsightType> types,
                    List<InsightCardResponse> cards) {
        try {
            redis.opsForValue().set(key(userId, period, at, types), objectMapper.writeValueAsString(cards),
                    jitteredTtl());
        } catch (Exception e) {
            log.warn("Cache write failed for userId={}, period={}: {}", userId, period, e.getMessage());
        }
    }

    private String key(UUID userId, ReportPeriod period, LocalDate at, Set<InsightType> types) {
        return "insight:feed:" + userId + ":" + period + ":" + at + ":" + InsightType.cacheSuffix(types);
    }

    private Duration jitteredTtl() {
        long base = BASE_TTL.toSeconds();
        long jitter = ThreadLocalRandom.current().nextLong(-base / 5, base / 5 + 1);
        return Duration.ofSeconds(base + jitter);
    }
}