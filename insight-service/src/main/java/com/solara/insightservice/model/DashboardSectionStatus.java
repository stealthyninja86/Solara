package com.solara.insightservice.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum DashboardSectionStatus {
    OK("ok"),
    UNAVAILABLE("unavailable"),
    SKIPPED("skipped");

    private final String wireValue;

    DashboardSectionStatus(String wireValue) {
        this.wireValue = wireValue;
    }

    @JsonValue
    public String wireValue() {
        return wireValue;
    }
}
