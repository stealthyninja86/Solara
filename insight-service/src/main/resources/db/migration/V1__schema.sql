CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE categorized_transactions (
    transaction_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    merchant VARCHAR(200) NOT NULL,
    normalized_merchant VARCHAR(200),
    original_description VARCHAR(500),
    description VARCHAR(500),
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    category VARCHAR(50),
    confidence NUMERIC(5, 4),
    categorization_method VARCHAR(20),
    is_subscription BOOLEAN NOT NULL,
    needs_review BOOLEAN NOT NULL,
    agent_attempts INTEGER NOT NULL,
    agent_failed BOOLEAN NOT NULL,
    bulk_import BOOLEAN NOT NULL DEFAULT false,
    payment_mode VARCHAR(20),
    type VARCHAR(10),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_ct_report ON categorized_transactions (user_id, type, created_at DESC);

CREATE TABLE processed_events (
    event_id UUID PRIMARY KEY,
    consumer_group VARCHAR(50) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE budget_settings (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    month_start DATE NOT NULL,
    monthly_budget NUMERIC(12, 2),
    monthly_income NUMERIC(12, 2),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT budget_settings_user_month_start_unique UNIQUE (user_id, month_start)
);

CREATE TABLE merchant_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    merchant TEXT NOT NULL,
    normalized_merchant TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    embedding vector(768) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uk_merchant_profiles_user_merchant UNIQUE (user_id, normalized_merchant),
    CONSTRAINT merchant_profiles_category_check CHECK (
        category IN ('FOOD_DINING', 'TRANSPORT', 'SHOPPING', 'ENTERTAINMENT', 'BILLS_UTILITIES',
                     'HEALTHCARE', 'GROCERIES', 'RENT', 'SALARY', 'INVESTMENT', 'EDUCATION',
                     'TRAVEL', 'OTHER', 'BUDGET')
    )
);

CREATE INDEX idx_merchant_profiles_hnsw ON merchant_profiles USING hnsw (embedding vector_cosine_ops);

CREATE TABLE transaction_embeddings (
    id UUID PRIMARY KEY,
    transaction_id UUID NOT NULL,
    user_id UUID NOT NULL,
    merchant TEXT NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    embedding vector(768),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_te_vector ON transaction_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    merchant VARCHAR(200) NOT NULL,
    normalized_merchant VARCHAR(200) NOT NULL,
    frequency VARCHAR(20) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    next_expected_date DATE NOT NULL,
    last_charge_date DATE,
    last_charge_amount NUMERIC(12, 2),
    kind VARCHAR(20) NOT NULL DEFAULT 'SUBSCRIPTION',
    amount_tolerance_percent INTEGER,
    tenure_months INTEGER,
    paid_months INTEGER,
    payee_merchant VARCHAR(200),
    last_charge_transaction_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_subscriptions_user_status ON subscriptions (user_id, status);
CREATE INDEX idx_subscriptions_normalized_merchant ON subscriptions (normalized_merchant);
CREATE INDEX idx_subscriptions_payee_merchant ON subscriptions (payee_merchant);