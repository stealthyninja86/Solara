CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE transaction_embeddings (
                                        id UUID PRIMARY KEY,
                                        transaction_id UUID NOT NULL,
                                        user_id UUID NOT NULL,
                                        merchant TEXT NOT NULL,
                                        description TEXT,
                                        category VARCHAR(50) NOT NULL,
                                        embedding VECTOR(1536),
                                        created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_te_user ON transaction_embeddings (user_id);
CREATE INDEX idx_te_vector ON transaction_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);