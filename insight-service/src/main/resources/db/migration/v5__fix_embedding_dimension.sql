DROP INDEX IF EXISTS idx_te_vector;
ALTER TABLE transaction_embeddings DROP COLUMN embedding;
ALTER TABLE transaction_embeddings ADD COLUMN embedding VECTOR(768);
CREATE INDEX idx_te_vector ON transaction_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
