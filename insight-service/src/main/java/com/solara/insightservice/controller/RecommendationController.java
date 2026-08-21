package com.solara.insightservice.controller;

import com.solara.insightservice.dto.response.RecommendationResponse;
import com.solara.insightservice.exception.AiInsightsDisabledException;
import com.solara.insightservice.model.ReportPeriod;
import com.solara.insightservice.service.insight.InsightSurfaceService;
import com.solara.insightservice.service.ratelimit.RegenerationRateLimiter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/insights")
public class RecommendationController {

    private static final Logger log = LoggerFactory.getLogger(RecommendationController.class);

    private final InsightSurfaceService insightSurfaceService;
    private final RegenerationRateLimiter regenerationRateLimiter;

    public RecommendationController(InsightSurfaceService insightSurfaceService,
                                    RegenerationRateLimiter regenerationRateLimiter) {
        this.insightSurfaceService = insightSurfaceService;
        this.regenerationRateLimiter = regenerationRateLimiter;
    }

    @GetMapping("/recommendations")
    public ResponseEntity<List<RecommendationResponse>> recommendations(
            @RequestParam UUID userId,
            @RequestParam ReportPeriod period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate at,
            @RequestParam(defaultValue = "false") boolean refresh) {
        if (!insightSurfaceService.isLlmEnabled(userId)) {
            log.info("recommendations rejected: userId={}, llmEnabled=false", userId);
            throw new AiInsightsDisabledException();
        }
        if (refresh) {
            regenerationRateLimiter.consume(userId);
        }
        return ResponseEntity.ok(insightSurfaceService.recommendations(userId, period, at, refresh));
    }
}