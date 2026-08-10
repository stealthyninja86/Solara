package com.solara.insightservice.model;

public enum CardRejectionReason {

    MISSING_FIELD,
    LENGTH_EXCEEDED,
    BARE_NUMBER,
    UNMAPPED_TOKEN;

    public String correctiveHint() {
        return switch (this) {
            case MISSING_FIELD ->
                    "a required field (headline, body or suggestion) was missing or blank";
            case LENGTH_EXCEEDED ->
                    "a field exceeded the length caps";
            case BARE_NUMBER ->
                    "you wrote a number, currency symbol or percent sign directly — never write numbers "
                            + "yourself; reference values ONLY through the [fact.x] tokens, which are "
                            + "replaced with the real values";
            case UNMAPPED_TOKEN ->
                    "you referenced a token that does not exist — use only the [fact.x], "
                            + "[fact.x].previous and [fact.x].delta tokens, and only when the fact "
                            + "provides that value (a fact without a change has no .delta)";
        };
    }
}
