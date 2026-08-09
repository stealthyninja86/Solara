package com.solara.insightservice.service;

import com.solara.insightservice.dto.response.AgentResult;
import com.solara.insightservice.model.MerchantKnowledgeBase;
import com.solara.insightservice.model.MerchantProfile;
import com.solara.insightservice.model.TransactionCategory;
import com.solara.insightservice.repository.MerchantKnowledgeBaseRepository;
import com.solara.insightservice.repository.MerchantProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Component
public class MerchantResolver {

    private static final Logger log = LoggerFactory.getLogger(MerchantResolver.class);

    private final MerchantKnowledgeBaseRepository knowledgeBaseRepository;
    private final MerchantProfileRepository merchantProfileRepository;

    public MerchantResolver(MerchantKnowledgeBaseRepository knowledgeBaseRepository,
                            MerchantProfileRepository merchantProfileRepository) {
        this.knowledgeBaseRepository = knowledgeBaseRepository;
        this.merchantProfileRepository = merchantProfileRepository;
    }

    public String normalize(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
    }

    public AgentResult resolve(UUID userId, String rawMerchant, String normalizedMerchant) {
        // 1. Per-user profile lookup — user overrides beat the global KB
        Optional<MerchantProfile> profileHit = merchantProfileRepository
            .findByUserIdAndNormalizedMerchant(userId, normalizedMerchant);
        if (profileHit.isPresent()) {
            MerchantProfile profile = profileHit.get();
            log.debug("User profile hit: normalized='{}' → category={}", normalizedMerchant, profile.getCategory());
            return new AgentResult(
                profile.getCategory(),
                BigDecimal.valueOf(0.90),
                "user-profile",
                profile.getMerchant(),
                profile.getDescription()
            );
        }

        // 2. Alias lookup (global KB)
        String alias = normalize(rawMerchant);
        Optional<MerchantKnowledgeBase> kbHit = knowledgeBaseRepository.findByAlias(alias);
        if (kbHit.isPresent()) {
            MerchantKnowledgeBase kb = kbHit.get();
            log.debug("KB alias hit: alias='{}' → canonical='{}', category={}", alias, kb.getCanonicalName(), kb.getCategory());
            return new AgentResult(
                TransactionCategory.valueOf(kb.getCategory()),
                kb.getConfidence(),
                "kb-alias",
                kb.getCanonicalName(),
                null
            );
        }

        return null;
    }
}
