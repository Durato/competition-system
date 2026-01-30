-- Migration 002: Add CPF and Accommodation fields
-- Run: psql $DATABASE_URL -f migrations/002_add_cpf_accommodation.sql

-- CPF field for user registration
ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf VARCHAR(14) UNIQUE;

-- Accommodation tracking (200 spots)
ALTER TABLE users ADD COLUMN IF NOT EXISTS needs_accommodation BOOLEAN DEFAULT false;
