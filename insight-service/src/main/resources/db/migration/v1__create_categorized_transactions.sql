CREATE TABLE categorized_transactions (
                                          transaction_id UUID PRIMARY KEY,
                                          user_id UUID NOT NULL,
                                          merchant VARCHAR(200) NOT NULL,
                                          normalized_merchant VARCHAR(200),
                                          original_description VARCHAR(500),
                                          amount DECIMAL(12, 2) NOT NULL,
                                          currency VARCHAR(3) NOT NULL DEFAULT 'INR',
                                          category VARCHAR(50),
                                          confidence DECIMAL(5, 4),
                                          categorization_method VARCHAR(20),
                                          is_subscription BOOLEAN NOT NULL DEFAULT FALSE,
                                          needs_review BOOLEAN NOT NULL DEFAULT FALSE,
                                          agent_attempts INTEGER NOT NULL DEFAULT 0,
                                          agent_failed BOOLEAN NOT NULL DEFAULT FALSE,
                                          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                                          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ct_user ON categorized_transactions (user_id, created_at DESC);
CREATE INDEX idx_ct_needs_review ON categorized_transactions (user_id, needs_review) WHERE needs_review = TRUE;
CREATE INDEX idx_ct_uncategorized ON categorized_transactions (user_id) WHERE category IS NULL;