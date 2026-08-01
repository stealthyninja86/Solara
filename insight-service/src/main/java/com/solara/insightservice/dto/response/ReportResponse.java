package com.solara.insightservice.dto.response;

import com.solara.insightservice.model.ReportPeriod;

import java.util.List;
import java.util.UUID;

public record ReportResponse(UUID userId, ReportPeriod period,
                             ReportSummary summary,
                             List<ReportCategorySpending> categories,
                             List<ReportTrendPoint> trend) {}
