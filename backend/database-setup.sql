-- PostgreSQL Database Setup for E2E Chat App
-- Run this script to create the database (if not using the auto-initialization)

-- Create database (run as postgres superuser)
-- CREATE DATABASE e2e_chat;

-- Connect to the database
-- \c e2e_chat;

-- The schema will be automatically created by the application
-- But you can also run these manually if needed:

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  public_key JSONB,
  socket_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  encrypted_message BYTEA NOT NULL,
  iv BYTEA NOT NULL,
  tag BYTEA,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_from_user ON messages(from_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_to_user ON messages(to_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Verify tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('users', 'messages');

