package com.solara.insightservice.dto.response;

import java.math.BigDecimal;

public record ReportTrendPoint(String label, BigDecimal income, BigDecimal expenses) {}
