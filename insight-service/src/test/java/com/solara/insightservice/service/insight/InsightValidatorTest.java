package com.solara.insightservice.service.insight;

import com.solara.insightservice.dto.response.InsightFact;
import com.solara.insightservice.dto.response.InsightTextResponse;
import com.solara.insightservice.model.CardRejectionReason;
import com.solara.insightservice.model.InsightType;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class InsightValidatorTest {

    private final InsightValidator validator = new InsightValidator();

    private InsightFact fact() {
        return new InsightFact("savings_rate", "Savings rate", "42%", null, null,
                InsightType.STATUS, "savings as a share of income");
    }

    @Test
    void acceptsCardTextReferencingOnlyProvidedTokens() {
        InsightTextResponse response = new InsightTextResponse(
                "[fact.savings_rate] higher this month",
                "Spending stayed flat",
                "Review your budget");

        assertThat(validator.validate(response, fact())).isEmpty();
    }

    @Test
    void rejectsBlankFieldsAsMissingField() {
        InsightTextResponse response = new InsightTextResponse("", "body", "suggestion");

        assertThat(validator.validate(response, fact()))
                .contains(CardRejectionReason.MISSING_FIELD);
    }

    @Test
    void rejectsBareNumbersOutsideTokens() {
        InsightTextResponse response = new InsightTextResponse(
                "Savings improved",
                "You saved 42% this month",
                "Review your budget");

        assertThat(validator.validate(response, fact()))
                .contains(CardRejectionReason.BARE_NUMBER);
    }
}