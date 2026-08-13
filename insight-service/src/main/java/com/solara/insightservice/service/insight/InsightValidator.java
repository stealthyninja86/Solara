package com.solara.insightservice.service.insight;

import com.solara.insightservice.dto.response.InsightFact;
import com.solara.insightservice.dto.response.InsightTextResponse;
import com.solara.insightservice.model.CardRejectionReason;
import com.solara.insightservice.model.InsightType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

@Component
public class InsightValidator {

    private static final Logger log = LoggerFactory.getLogger(InsightValidator.class);

    private static final int MAX_HEADLINE = 220;
    private static final int MAX_BODY = 900;
    private static final int MAX_BODY_ACTION = 1200;
    private static final int MAX_SUGGESTION = 400;

    private static final Pattern TOKEN = Pattern.compile("\\[fact\\.[a-z_.]+]");
    private static final Pattern INNER_TOKEN_SUFFIX = Pattern.compile("\\[fact\\.([a-z_]+)\\.(previous|delta)]");
    private static final Pattern HAS_DIGIT_OR_CURRENCY = Pattern.compile("[0-9₹%×$]");
    private static final Pattern NUMBER_OR_CURRENCY = Pattern.compile("[₹$]?\\s?[0-9][0-9,.]*\\s?%?");

    public Optional<CardRejectionReason> validate(InsightTextResponse response, InsightFact fact) {
        if (response == null
                || isBlank(response.headline())
                || isBlank(response.body())
                || isBlank(response.suggestion())) {
            log.warn("Validation rejected: missing card-text fields");
            return Optional.of(CardRejectionReason.MISSING_FIELD);
        }
        if (response.headline().length() > MAX_HEADLINE
                || response.body().length() > maxBodyFor(fact.type())
                || response.suggestion().length() > MAX_SUGGESTION) {
            log.warn("Validation rejected: length cap exceeded ({})", lengthViolations(response, fact));
            return Optional.of(CardRejectionReason.LENGTH_EXCEEDED);
        }
        String all = normalizeTokenSuffixes(
                response.headline() + " " + response.body() + " " + response.suggestion());
        String withoutTokens = TOKEN.matcher(all).replaceAll("");
        String rawContent = stripKnownValues(withoutTokens, fact);
        if (HAS_DIGIT_OR_CURRENCY.matcher(rawContent).find()) {
            log.warn("Validation rejected: bare number or currency outside tokens: {}", rawContent);
            return Optional.of(CardRejectionReason.BARE_NUMBER);
        }
        // Every [fact.x] must resolve to the fact the engine provided — nothing invented.
        var tokens = TOKEN.matcher(all).results()
                .map(match -> match.group())
                .distinct()
                .toList();
        var unknownTokens = tokens.stream()
                .filter(token -> !tokenMatchesFact(token, fact))
                .toList();
        if (!unknownTokens.isEmpty()) {
            log.warn("Validation rejected: unmapped token in card text: {} (fact {})",
                    unknownTokens, fact.id());
            return Optional.of(CardRejectionReason.UNMAPPED_TOKEN);
        }
        if (renderedTextHasStrayNumbers(fact.renderTokens(all), fact)) {
            log.warn("Validation rejected: rendered text contains stray number, currency or brackets");
            return Optional.of(CardRejectionReason.BARE_NUMBER);
        }
        return Optional.empty();
    }

    /**
     * Human-readable report of which fields exceeded their caps and by how
     * much — fed verbatim into the corrective re-prompt so the model knows
     * exactly what to shorten (a bare "length exceeded" gives it no target).
     */
    public String lengthViolations(InsightTextResponse response, InsightFact fact) {
        List<String> violations = new ArrayList<>();
        if (response.headline().length() > MAX_HEADLINE) {
            violations.add("headline was " + response.headline().length()
                    + " characters (maximum " + MAX_HEADLINE + ")");
        }
        int bodyCap = maxBodyFor(fact.type());
        if (response.body().length() > bodyCap) {
            violations.add("body was " + response.body().length()
                    + " characters (maximum " + bodyCap + ")");
        }
        if (response.suggestion().length() > MAX_SUGGESTION) {
            violations.add("suggestion was " + response.suggestion().length()
                    + " characters (maximum " + MAX_SUGGESTION + ")");
        }
        return String.join("; ", violations);
    }

    private int maxBodyFor(InsightType type) {
        return type == InsightType.ACTION ? MAX_BODY_ACTION : MAX_BODY;
    }

    private boolean renderedTextHasStrayNumbers(String rendered, InsightFact fact) {
        // Strip formatted variants of VALUES ALREADY KNOWN TO THE FACT — the
        // model legitimately wraps them in its own currency/comma/percent
        // formatting ("49%", "₹ 4,200") which never equals the canonical
        // string by character. Only digit-identity with a known fact value
        // admits them; any other remaining number is invented → reject.
        String stripped = stripKnownValues(rendered, fact);
        if (stripped.contains(".delta") || stripped.contains(".previous")
                || stripped.contains("[fact.") || stripped.contains("fact.")
                || stripped.contains("delta") || stripped.contains("token")
                || stripped.contains("percent")
                || stripped.contains("—")
                || stripped.contains("{") || stripped.contains("}")) {
            log.warn("Validation rejected: rendered text keeps token or format residue: {}", stripped);
            return true;
        }
        if (stripped.contains("[") || stripped.contains("]")) {
            return true;
        }
        if (HAS_DIGIT_OR_CURRENCY.matcher(stripped).find()) {
            log.warn("Validation rejected: rendered text contains stray number or currency: {}", stripped);
            return true;
        }
        return false;
    }

    private String normalizeTokenSuffixes(String text) {
        // The model sometimes renders the token with the suffix INSIDE the
        // brackets ([fact.x.previous], [fact.x.delta]). Normalize to the
        // canonical outer form ([fact.x].previous) before validation and
        // rendering, so those cards validate and render instead of dying.
        return INNER_TOKEN_SUFFIX.matcher(text).replaceAll("[fact.$1].$2");
    }

    private String stripKnownValues(String rendered, InsightFact fact) {
        String stripped = rendered;
        List<String> knownValues = new ArrayList<>();
        if (fact.value() != null) knownValues.add(fact.value());
        if (fact.previousValue() != null) knownValues.add(fact.previousValue());
        if (fact.changePercent() != null) knownValues.add(fact.changePercent() + "%");
        for (String known : knownValues) {
            String knownDigits = onlyDigits(known);
            if (knownDigits.isEmpty()) continue;
            stripped = NUMBER_OR_CURRENCY.matcher(stripped)
                    .replaceAll(match -> onlyDigits(match.group()).equals(knownDigits)
                            ? " "
                            : match.group());
        }
        return stripped;
    }

    private String onlyDigits(String value) {
        StringBuilder digits = new StringBuilder();
        for (char c : value.toCharArray()) {
            if (Character.isDigit(c)) digits.append(c);
        }
        return digits.toString();
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
