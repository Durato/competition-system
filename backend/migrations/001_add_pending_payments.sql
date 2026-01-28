-- Migration: Add pending_payments table for tracking checkout items before Even3 confirmation
-- Run this SQL on your PostgreSQL database

-- Create pending_payments table
CREATE TABLE IF NOT EXISTS pending_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  member_ids UUID[] NOT NULL DEFAULT '{}',
  robot_ids UUID[] NOT NULL DEFAULT '{}',
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  even3_reference VARCHAR(255)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pending_payments_user_email ON pending_payments(LOWER(user_email));
CREATE INDEX IF NOT EXISTS idx_pending_payments_status ON pending_payments(status);
CREATE INDEX IF NOT EXISTS idx_pending_payments_team ON pending_payments(team_id);
CREATE INDEX IF NOT EXISTS idx_pending_payments_user ON pending_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_payments_created ON pending_payments(created_at DESC);

-- Create index on users email for faster lookups (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));

-- Add is_paid column to robots if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'robots' AND column_name = 'is_paid'
  ) THEN
    ALTER TABLE robots ADD COLUMN is_paid BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Create webhook_logs table for debugging (optional)
CREATE TABLE IF NOT EXISTS webhook_logs (
  id SERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  action VARCHAR(100),
  payload JSONB,
  headers JSONB,
  received_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed BOOLEAN DEFAULT false,
  process_result TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_received ON webhook_logs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON webhook_logs(source);

-- Add comment to tables
COMMENT ON TABLE pending_payments IS 'Tracks checkout items before Even3 payment confirmation';
COMMENT ON TABLE webhook_logs IS 'Logs incoming webhooks for debugging and auditing';
