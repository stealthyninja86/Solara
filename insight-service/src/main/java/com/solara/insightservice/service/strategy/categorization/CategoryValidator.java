package com.solara.insightservice.service.strategy.categorization;

import com.solara.insightservice.dto.response.AgentResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@Component
public class CategoryValidator {

    private static final Logger log = LoggerFactory.getLogger(CategoryValidator.class);

    private static final BigDecimal MIN_CONFIDENCE = new BigDecimal("0.70");
    private static final int MIN_TOKEN_LENGTH = 3;

    public AgentResult validate(AgentResult result) {
        return validate(result, null);
    }

    public AgentResult validate(AgentResult result, String rawNarration) {
        if (result == null || result.category() == null) {
            log.warn("Validation rejected: no category (raw result={})", result);
            return null;
        }
        if (result.confidence() == null || result.confidence().compareTo(MIN_CONFIDENCE) < 0) {
            log.warn("Validation rejected: confidence={} below threshold={} for category={}, merchant={}",
                    result.confidence(), MIN_CONFIDENCE, result.category(), result.merchant());
            return null;
        }
        if (rawNarration != null && result.merchant() != null && !isGrounded(result.merchant(), rawNarration)) {
            log.warn("Validation rejected: merchant '{}' not grounded in raw narration '{}' (category={}, confidence={})",
                    result.merchant(), rawNarration, result.category(), result.confidence());
            return null;
        }
        log.debug("Validation accepted: category={}, merchant={}, confidence={}",
                result.category(), result.merchant(), result.confidence());
        return result;
    }

    private boolean isGrounded(String merchant, String rawNarration) {
        String normalizedNarration = normalize(rawNarration);
        List<String> tokens = significantTokens(merchant);
        if (tokens.isEmpty()) {
            log.debug("Grounding skipped: merchant '{}' has no significant tokens", merchant);
            return true;
        }
        for (String token : tokens) {
            if (!normalizedNarration.contains(token)) {
                return false;
            }
        }
        return true;
    }

    private List<String> significantTokens(String merchant) {
        return Arrays.stream(normalize(merchant).split(" "))
                .filter(token -> token.length() >= MIN_TOKEN_LENGTH)
                .filter(token -> token.chars().anyMatch(Character::isLetter))
                .toList();
    }

    private String normalize(String value) {
        return value.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
    }
}
