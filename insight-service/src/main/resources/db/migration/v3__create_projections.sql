CREATE TABLE projections (
                             id UUID PRIMARY KEY,
                             user_id UUID NOT NULL,
                             category VARCHAR(50) NOT NULL,
                             period VARCHAR(10) NOT NULL,
                             period_start DATE NOT NULL,
                             total_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
                             transaction_count INTEGER NOT NULL DEFAULT 0,
                             created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                             updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                             UNIQUE (user_id, category, period, period_start)
);

CREATE INDEX idx_proj_user ON projections (user_id, period, period_start DESC);