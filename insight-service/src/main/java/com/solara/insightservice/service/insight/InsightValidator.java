package com.solara.insightservice.service.insight;

import com.solara.insightservice.dto.response.InsightFact;
import com.solara.insightservice.dto.response.InsightTextResponse;
import com.solara.insightservice.model.CardRejectionReason;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.regex.Pattern;

@Component
public class InsightValidator {

    private static final Logger log = LoggerFactory.getLogger(InsightValidator.class);

    private static final int MAX_HEADLINE = 80;
    private static final int MAX_BODY = 200;
    private static final int MAX_SUGGESTION = 120;

    private static final Pattern TOKEN = Pattern.compile("\\[fact\\.[a-z_.]+]");
    private static final Pattern HAS_DIGIT_OR_CURRENCY = Pattern.compile("[0-9₹%×$]");

    public Optional<CardRejectionReason> validate(InsightTextResponse response, InsightFact fact) {
        if (response == null
                || isBlank(response.headline())
                || isBlank(response.body())
                || isBlank(response.suggestion())) {
            log.warn("Validation rejected: missing card-text fields");
            return Optional.of(CardRejectionReason.MISSING_FIELD);
        }
        if (response.headline().length() > MAX_HEADLINE
                || response.body().length() > MAX_BODY
                || response.suggestion().length() > MAX_SUGGESTION) {
            log.warn("Validation rejected: length cap exceeded");
            return Optional.of(CardRejectionReason.LENGTH_EXCEEDED);
        }
        String all = response.headline() + " " + response.body() + " " + response.suggestion();
        String withoutTokens = TOKEN.matcher(all).replaceAll("");
        if (HAS_DIGIT_OR_CURRENCY.matcher(withoutTokens).find()) {
            log.warn("Validation rejected: bare number or currency outside tokens");
            return Optional.of(CardRejectionReason.BARE_NUMBER);
        }
        // Every [fact.x] must resolve to the fact the engine provided — nothing invented.
        var tokens = TOKEN.matcher(all).results()
                .map(match -> match.group())
                .distinct()
                .toList();
        if (!tokens.stream().allMatch(token -> tokenMatchesFact(token, fact))) {
            log.warn("Validation rejected: unmapped token in card text");
            return Optional.of(CardRejectionReason.UNMAPPED_TOKEN);
        }
        if (renderedTextHasStrayNumbers(fact.renderTokens(all), fact)) {
            log.warn("Validation rejected: rendered text contains stray number, currency or brackets");
            return Optional.of(CardRejectionReason.BARE_NUMBER);
        }
        return Optional.empty();
    }

    private boolean renderedTextHasStrayNumbers(String rendered, InsightFact fact) {
        String stripped = rendered;
        if (fact.value() != null) {
            stripped = stripped.replace(fact.value(), "");
        }
        if (fact.previousValue() != null) {
            stripped = stripped.replace(fact.previousValue(), "");
        }
        if (fact.changePercent() != null) {
            stripped = stripped.replace(fact.changePercent() + "%", "");
        }
        if (stripped.contains(".delta") || stripped.contains(".previous")
                || stripped.contains("[fact.") || stripped.contains("fact.")
                || stripped.contains("delta") || stripped.contains("token")
                || stripped.contains("percent")
                || stripped.contains("—")
                || stripped.contains("{") || stripped.contains("}")) {
            return true;
        }
        if (stripped.contains("[") || stripped.contains("]")) {
            return true;
        }
        return HAS_DIGIT_OR_CURRENCY.matcher(stripped).find();
    }

    private boolean tokenMatchesFact(String token, InsightFact fact) {
        if (token.equals(fact.tokenReference())) {
            return true;                                          // "[fact.spending_delta]"
        }
        if (token.equals(fact.tokenReference() + ".previous")) {
            return fact.previousValue() != null;                  // value must exist
        }
        if (token.equals(fact.tokenReference() + ".delta")) {
            return fact.changePercent() != null;                  // value must exist
        }
        return false;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
