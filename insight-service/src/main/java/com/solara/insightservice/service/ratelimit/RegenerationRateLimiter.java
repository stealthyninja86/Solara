package com.solara.insightservice.service.ratelimit;

import com.solara.insightservice.exception.RateLimitExceededException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Component
public class RegenerationRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(RegenerationRateLimiter.class);

    private static final long WINDOW_SECONDS = Duration.ofHours(24).toSeconds();

    private static final DefaultRedisScript<Long> INCR_WITH_TTL = new DefaultRedisScript<>("""
            local count = redis.call('INCR', KEYS[1])
            if count == 1 then
                redis.call('EXPIRE', KEYS[1], ARGV[1])
            end
            return count
            """, Long.class);

    private final StringRedisTemplate redis;
    private final long bucketCapacity;

    public RegenerationRateLimiter(StringRedisTemplate redis,
                                   @Value("${app.regeneration.limit-per-day:5}") long bucketCapacity) {
        this.redis = redis;
        this.bucketCapacity = bucketCapacity;
    }

    public void consume(UUID userId) {
        String key = key(userId);
        try {
            Long count = redis.execute(INCR_WITH_TTL, List.of(key), Long.toString(WINDOW_SECONDS));
            if (count != null && count > bucketCapacity) {
                Long remaining = redis.getExpire(key, TimeUnit.SECONDS);
                long retryAfter = remaining != null ? Math.max(remaining, 1) : WINDOW_SECONDS;
                log.warn("Regeneration rate limited: userId={}, count={}, retryAfterSeconds={}",
                        userId, count, retryAfter);
                throw new RateLimitExceededException(retryAfter,
                        "You've reached the regeneration limit (" + bucketCapacity
                                + " per 24 hours). Try again in " + humanize(retryAfter) + ".");
            }
        } catch (RateLimitExceededException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Regeneration rate limiter failed open: {}", e.getMessage());
        }
    }

    /** Read-only usage count — powers the frontend "X of Y left today" counter. */
    public long used(UUID userId) {
        try {
            String value = redis.opsForValue().get(key(userId));
            return value == null ? 0 : Long.parseLong(value);
        } catch (Exception e) {
            log.warn("Regeneration status read failed: {}", e.getMessage());
            return 0;
        }
    }

    public long limit() {
        return bucketCapacity;
    }

    private String key(UUID userId) {
        return "insight:regen:" + userId;
    }

    private static String humanize(long seconds) {
        long hours = seconds / 3600;
        long minutes = (seconds % 3600) / 60;
        if (hours > 0 && minutes > 0) return hours + "h " + minutes + "m";
        if (hours > 0) return hours + "h";
        return minutes > 0 ? minutes + "m" : "less than a minute";
    }
}
