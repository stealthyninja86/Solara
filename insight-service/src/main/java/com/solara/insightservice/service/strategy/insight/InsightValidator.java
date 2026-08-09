package com.solara.insightservice.service.strategy.insight;

import com.solara.insightservice.dto.response.InsightFact;
import com.solara.insightservice.dto.response.InsightTextResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

/**
 * The one genuinely important safety piece of the Overview pipeline. Four
 * structural checks — none require another LLM call:
 *
 * <ol>
 *   <li>all three fields present and non-blank</li>
 *   <li>no bare digits / "₹N" / "N%" / "N×" remain outside token land — the
 *       model is arithmetically mute</li>
 *   <li>every {@code [fact.x]} token resolves to the fact the engine selected —
 *       nothing invented</li>
 *   <li>length caps so a five-card feed can never render an essay</li>
 * </ol>
 *
 * Invalid card text is dropped with the card — the feed never shows
 * unvalidated text, never a degraded card, never a broken feed.
 */
@Component
public class InsightValidator {

    private static final Logger log = LoggerFactory.getLogger(InsightValidator.class);

    private static final int MAX_HEADLINE = 80;
    private static final int MAX_BODY = 200;
    private static final int MAX_SUGGESTION = 120;

    private static final Pattern TOKEN = Pattern.compile("\\[fact\\.[a-z_.]+]");
    private static final Pattern HAS_DIGIT_OR_CURRENCY = Pattern.compile("[0-9₹%×]");

    public boolean validate(InsightTextResponse response, InsightFact fact) {
        if (response == null
                || isBlank(response.headline())
                || isBlank(response.body())
                || isBlank(response.suggestion())) {
            log.warn("Validation rejected: missing card-text fields");
            return false;
        }
        if (response.headline().length() > MAX_HEADLINE
                || response.body().length() > MAX_BODY
                || response.suggestion().length() > MAX_SUGGESTION) {
            log.warn("Validation rejected: length cap exceeded");
            return false;
        }
        String all = response.headline() + " " + response.body() + " " + response.suggestion();
        String withoutTokens = TOKEN.matcher(all).replaceAll("");
        if (HAS_DIGIT_OR_CURRENCY.matcher(withoutTokens).find()) {
            log.warn("Validation rejected: bare number or currency outside tokens");
            return false;
        }
        // Every [fact.x] must resolve to the fact the engine provided — nothing invented.
        var tokens = TOKEN.matcher(all).results()
                .map(match -> match.group())
                .distinct()
                .toList();
        if (!tokens.stream().allMatch(token -> tokenMatchesFact(token, fact))) {
            log.warn("Validation rejected: unmapped token in card text");
            return false;
        }
        return true;
    }

    private boolean tokenMatchesFact(String token, InsightFact fact) {
        return token.equals(fact.tokenReference())            // "[fact.spending_delta]"
                || token.equals(fact.tokenReference() + ".previous")  // values the backend owns
                || token.equals(fact.tokenReference() + ".delta");
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
