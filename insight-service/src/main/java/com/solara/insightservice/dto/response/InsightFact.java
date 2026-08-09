package com.solara.insightservice.dto.response;

import com.solara.insightservice.model.InsightQuestion;

/**
 * The unit of truth transferred between the analytics engine and the narrator.
 * The {@code value} / {@code previousValue} / {@code changePercent} fields are
 * display-ready strings ("₹2,400", "42%") — neither the LLM nor the template
 * ever formats numbers itself.
 *
 * <p>The id doubles as the token namespace: the narrator references values as
 * {@code [fact.&lt;id&gt;]}, {@code [fact.&lt;id&gt;.previous]},
 * {@code [fact.&lt;id&gt;.delta]} and the validator checks every token resolves
 * to one of these exactly.</p>
 */
public record InsightFact(
        String id,              // "savings_rate", "over_budget", "top_category_share", "spending_delta"
        String label,           // "Savings rate", "Food spending"
        String value,           // display-ready: "₹2,400", "42%", "4.2×"
        String previousValue,   // display-ready comparison, or null
        String changePercent,   // optional "42" or null
        InsightQuestion question
) {

    public String tokenReference() {
        return "[fact." + id + "]";
    }
}