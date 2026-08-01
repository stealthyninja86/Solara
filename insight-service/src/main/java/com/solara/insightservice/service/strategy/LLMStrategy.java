package com.solara.insightservice.service.strategy;

import com.solara.insightservice.dto.response.AgentResult;
import com.solara.insightservice.dto.request.CategorizationInput;

@FunctionalInterface
public interface LLMStrategy {
    AgentResult execute(CategorizationInput input);
}
