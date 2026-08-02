ALTER TABLE projections ADD COLUMN transaction_type VARCHAR(10) NOT NULL DEFAULT 'DEBIT';

ALTER TABLE projections DROP CONSTRAINT IF EXISTS projections_unique;
ALTER TABLE projections DROP CONSTRAINT IF EXISTS ukieku2mpwicjxrdupcfv94829j;

ALTER TABLE projections ADD CONSTRAINT projections_unique
    UNIQUE (user_id, category, period, period_start, transaction_type);

CREATE INDEX idx_proj_user_type ON projections (user_id, period, transaction_type, period_start DESC);
DROP INDEX IF EXISTS idx_proj_user;
