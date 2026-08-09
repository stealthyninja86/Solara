package com.solara.insightservice.dto.response;

/**
 * Health of the LLM runtime (Ollama), served to the settings page so it can
 * explain why insight cards are hidden. {@code available} means the Ollama
 * server answered the {@code /api/tags} probe within the timeout — nothing
 * more, nothing less.
 */
public record AiStatusResponse(
        boolean available
) {
}
