package com.solara.insightservice.llm.factory;

import org.springframework.ai.chat.model.ChatModel;

@FunctionalInterface
public interface ChatModelFactory {

    ChatModel create(String apiKey, String model);
}
