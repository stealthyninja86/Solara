package com.solara.insightservice.dto.response;

import com.solara.insightservice.model.InsightType;

import java.util.regex.Pattern;

public record InsightFact(
        String id,              // "savings_rate", "over_budget", "top_category_share", "spending_delta"
        String label,           // "Savings rate", "Food spending"
        String value,           // display-ready: "₹2,400", "42%", "4.2×"
        String previousValue,   // display-ready comparison, or null
        String changePercent,   // optional "42" or null
        InsightType type,
        String hint             // plain-language meaning of the values, or null
) {

    private static final Pattern TOKEN = Pattern.compile("\\[fact\\.[a-z_.]+](?:\\.(?:previous|delta))?");

    public String tokenReference() {
        return "[fact." + id + "]";
    }

    public String renderTokens(String text) {
        return TOKEN.matcher(text).replaceAll(match -> {
            String token = match.group();
            if (token.equals(tokenReference())) {
                return value();
            }
            if (token.equals(tokenReference() + ".previous")) {
                return previousValue() != null ? previousValue() : "—";
            }
            if (token.equals(tokenReference() + ".delta")) {
                return changePercent() != null ? changePercent() + "%" : "—";
            }
            return token;
        });
    }
}