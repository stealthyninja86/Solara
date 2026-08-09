CREATE TABLE merchant_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alias TEXT NOT NULL,
    canonical_name TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    confidence DECIMAL(3,2),
    transaction_count BIGINT DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uk_mkb_alias ON merchant_knowledge_base (alias);
CREATE INDEX idx_mkb_canonical ON merchant_knowledge_base (canonical_name);
