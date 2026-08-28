CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    password VARCHAR(60) NOT NULL,
    icon_mode VARCHAR(10) NOT NULL DEFAULT 'icons',
    ai_settings BOOLEAN NOT NULL DEFAULT FALSE,
    llm_provider VARCHAR(20),
    llm_api_keys JSONB NOT NULL DEFAULT '{}',
    llm_chat_model VARCHAR(100)
);

CREATE UNIQUE INDEX idx_users_email ON users (email);
