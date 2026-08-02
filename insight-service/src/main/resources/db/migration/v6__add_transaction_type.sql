ALTER TABLE categorized_transactions ADD COLUMN type VARCHAR(10);

CREATE INDEX idx_ct_type ON categorized_transactions (user_id, type);
