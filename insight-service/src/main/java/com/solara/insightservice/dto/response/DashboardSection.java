package com.solara.insightservice.dto.response;

import com.solara.insightservice.model.DashboardSectionStatus;

public record DashboardSection(
    DashboardSectionStatus status,
    Object data,
    DashboardSectionError error
) {

    public static DashboardSection ok(Object data) {
        return new DashboardSection(DashboardSectionStatus.OK, data, null);
    }

    public static DashboardSection unavailable(String code, String message, boolean retryable) {
        return new DashboardSection(DashboardSectionStatus.UNAVAILABLE, null,
                new DashboardSectionError(code, message, retryable));
    }

    public static DashboardSection skipped() {
        return new DashboardSection(DashboardSectionStatus.SKIPPED, null, null);
    }
}
