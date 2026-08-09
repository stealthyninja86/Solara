package com.solara.insightservice.dto.response;

import java.util.List;

public record SolaraInsightResponse(String type,
                                    String headline,
                                    List<String> reasons,
                                    String suggestion) {}
