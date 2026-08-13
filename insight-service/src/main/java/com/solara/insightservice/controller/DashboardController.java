package com.solara.insightservice.controller;

import com.solara.insightservice.dto.response.DashboardResponse;
import com.solara.insightservice.model.ReportPeriod;
import com.solara.insightservice.service.dashboard.DashboardService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/insights")
public class DashboardController {

    private static final Logger log = LoggerFactory.getLogger(DashboardController.class);

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardResponse> dashboard(
            @RequestParam UUID userId,
            @RequestParam(defaultValue = "MONTHLY") ReportPeriod period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate at) {
        log.debug("dashboard requested: userId={}, period={}, at={}", userId, period, at);
        DashboardResponse response = dashboardService.get(userId, period, at);
        log.debug("dashboard returned: userId={}, sectionCount={}", userId, response.sections().size());
        return ResponseEntity.ok(response);
    }
}
