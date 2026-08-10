package com.solara.insightservice.service.categorization.strategy;

import com.solara.insightservice.dto.request.CategorizationInput;
import com.solara.insightservice.dto.response.AgentResult;

import java.util.List;

public interface LLMStrategy {

    AgentResult execute(CategorizationInput input);

    default boolean usesLlm() {
        return true;
    }

    default List<AgentResult> executeBatch(List<CategorizationInput> inputs) {
        return null;
    }
}
