package com.solara.insightservice.controller;

import com.solara.insightservice.dto.response.RecommendationResponse;
import com.solara.insightservice.model.ReportPeriod;
import com.solara.insightservice.service.RecommendationService;
import com.solara.insightservice.service.UserSettingsService;
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

/**
 * Separate controller per user directive — but it only vends what the shared
 * feed already holds (ACTION/NEXT-filtered), so Overview and Recommendations
 * can never disagree.
 */
@RestController
@RequestMapping("/api/v1/insights")
public class RecommendationController {

    private static final Logger log = LoggerFactory.getLogger(RecommendationController.class);

    private final RecommendationService recommendationService;

    public RecommendationController(RecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    @GetMapping("/recommendations")
    public ResponseEntity<List<RecommendationResponse>> recommendations(
            @RequestParam UUID userId,
            @RequestParam ReportPeriod period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate at) {
        return ResponseEntity.ok(recommendationService.recommendations(userId, period, at));
    }
}