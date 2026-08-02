package com.solara.insightservice.service.strategy.categorization;

import com.solara.insightservice.dto.request.CategorizationInput;
import com.solara.insightservice.dto.response.AgentResult;
import com.solara.insightservice.service.CategorizationService;
import com.solara.insightservice.service.strategy.LLMStrategy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

@Component
public class MerchantCache implements LLMStrategy {

    private static final Logger log = LoggerFactory.getLogger(MerchantCache.class);

    private final CategorizationService categorizationService;

    public MerchantCache(@Lazy CategorizationService categorizationService) {
        this.categorizationService = categorizationService;
    }

    @Override
    public AgentResult execute(CategorizationInput input) {
        if (input.isBulkImport()) {
            return null;
        }
        AgentResult cached = categorizationService.cacheGet(input.normalizedMerchant(), input.userId());
        if (cached != null) {
            log.debug("Cache hit for merchant={}", input.normalizedMerchant());
        }
        return cached;
    }
}
