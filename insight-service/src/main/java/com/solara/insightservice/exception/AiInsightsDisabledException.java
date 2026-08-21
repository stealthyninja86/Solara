package com.solara.insightservice.exception;

public class AiInsightsDisabledException extends RuntimeException {

    public static final String MESSAGE =
            "AI insights are turned off — enable AI insights in your settings to generate an overview";

    public AiInsightsDisabledException() {
        super(MESSAGE);
    }
}