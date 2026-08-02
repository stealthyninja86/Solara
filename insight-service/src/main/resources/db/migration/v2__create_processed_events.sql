CREATE TABLE processed_events (
                                  event_id UUID PRIMARY KEY,
                                  event_type VARCHAR(100) NOT NULL,
                                  consumer_group VARCHAR(100) NOT NULL DEFAULT 'insight-service',
                                  processed_at TIMESTAMP NOT NULL DEFAULT NOW()
);