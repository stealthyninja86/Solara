package com.solara.insightservice.dto.response;

import com.solara.insightservice.model.ReportPeriod;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ReportResponse(UUID userId, ReportPeriod period,
                             LocalDate from,
                             LocalDate to,
                             ReportSummary summary,
                             List<ReportCategorySpending> categories,
                             List<ReportTrendPoint> trend) {}
