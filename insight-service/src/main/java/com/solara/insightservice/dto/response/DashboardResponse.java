package com.solara.insightservice.dto.response;

import com.solara.insightservice.model.ReportPeriod;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

public record DashboardResponse(
    UUID userId,
    ReportPeriod period,
    LocalDate at,
    Map<String, DashboardSection> sections
) {}
