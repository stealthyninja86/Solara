package com.solara.insightservice.model;

import java.util.EnumSet;
import java.util.Set;

public enum InsightType {
    STATUS,
    ACTION,
    NEXT;

    public static final Set<InsightType> OVERVIEW = EnumSet.of(STATUS, NEXT);

    public static final Set<InsightType> RECOMMENDATIONS = EnumSet.of(ACTION);

    public static String cacheSuffix(Set<InsightType> types) {
        return types.stream()
                .map(Enum::name)
                .sorted()
                .reduce((left, right) -> left + "," + right)
                .orElse("none");
    }
}
