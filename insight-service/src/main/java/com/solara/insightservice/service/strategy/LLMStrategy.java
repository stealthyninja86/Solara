package com.solara.insightservice.service.strategy;

import com.solara.insightservice.dto.request.CategorizationInput;
import com.solara.insightservice.dto.response.AgentResult;

import java.util.List;

public interface LLMStrategy {

    AgentResult execute(CategorizationInput input);

    /**
     * Whether executing this strategy invokes an LLM (and therefore incurs cost/latency).
     * Strategies that only consult local state (e.g. the merchant cache) return false so
     * the chain can be pruned when a user has disabled smart categorization.
     */
    default boolean usesLlm() {
        return true;
    }

    /**
     * Batch variant. Implementations return a list aligned by index with {@code inputs}
     * (null where an item could not be classified). Strategies that are not batch-capable
     * return null, signalling callers to fall back to per-item {@link #execute}.
     */
    default List<AgentResult> executeBatch(List<CategorizationInput> inputs) {
        return null;
    }
}
