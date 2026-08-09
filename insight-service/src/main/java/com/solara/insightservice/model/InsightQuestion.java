package com.solara.insightservice.model;

/**
 * The question an insight card answers, from the §17 UX contract:
 * <ul>
 *   <li>{@link #STATUS} — "am I ok" (glanceable, no action)</li>
 *   <li>{@link #ACTION} — "what do I act on" (over-budget, spikes)</li>
 *   <li>{@link #NEXT} — "what's next" (upcoming charges)</li>
 * </ul>
 * Both the Overview surface (all questions) and the Recommendations surface
 * (ACTION + NEXT only) group on this discriminator.
 */
public enum InsightQuestion {
    STATUS,
    ACTION,
    NEXT
}