CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    description VARCHAR(500),
    merchant VARCHAR(200) NOT NULL,
    payment_mode VARCHAR(20) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user ON transactions (user_id, created_at DESC);
