CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    password VARCHAR(60) NOT NULL
);

CREATE UNIQUE INDEX idx_users_email ON users (email);