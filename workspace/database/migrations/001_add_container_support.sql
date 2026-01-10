-- Migration: Add container support to users table
-- Description: Add fields for user tier and container configuration
-- Version: 001

-- Add container-related columns to users table
ALTER TABLE users ADD COLUMN container_tier TEXT DEFAULT 'free';
ALTER TABLE users ADD COLUMN container_config TEXT;
ALTER TABLE users ADD COLUMN resource_quota TEXT;

-- Create index for container_tier
CREATE INDEX IF NOT EXISTS idx_users_container_tier ON users(container_tier);
