CREATE TABLE import_jobs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    total_rows INT NOT NULL DEFAULT 0,
    imported_rows INT NOT NULL DEFAULT 0,
    failed_rows INT NOT NULL DEFAULT 0,
    error_report TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX idx_import_jobs_user ON import_jobs (user_id, created_at DESC);
