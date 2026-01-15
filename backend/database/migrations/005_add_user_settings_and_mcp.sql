-- Migration 005: Add user settings and MCP servers tables
-- Description: Add tables for per-user Claude Code settings and MCP server configurations
-- Date: 2025-01-15

-- ====================================================================
-- User Settings Table
-- ====================================================================
-- Stores per-user settings for each AI provider (claude, cursor, codex)
-- Each user can have independent tool permissions and preference settings

CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('claude', 'cursor', 'codex')),
  allowed_tools TEXT DEFAULT '[]',
  disallowed_tools TEXT DEFAULT '[]',
  skip_permissions BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for user_settings
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_provider ON user_settings(provider);

-- ====================================================================
-- MCP Servers Table
-- ====================================================================
-- Stores per-user MCP (Model Context Protocol) server configurations
-- Each user can configure their own MCP servers for use in containers

CREATE TABLE IF NOT EXISTS user_mcp_servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('stdio', 'http', 'sse')),
  config TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for user_mcp_servers
CREATE INDEX IF NOT EXISTS idx_mcp_servers_user_id ON user_mcp_servers(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_name ON user_mcp_servers(name);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_enabled ON user_mcp_servers(enabled);

-- ====================================================================
-- Initialize Default Settings for Existing Users
-- ====================================================================
-- Create default settings for all existing users
-- Each user gets default settings for each provider

-- Claude provider defaults
INSERT OR IGNORE INTO user_settings (user_id, provider, allowed_tools, disallowed_tools, skip_permissions)
SELECT
  id,
  'claude',
  '[]',
  '[]',
  1
FROM users;

-- Cursor provider defaults
INSERT OR IGNORE INTO user_settings (user_id, provider, allowed_tools, disallowed_tools, skip_permissions)
SELECT
  id,
  'cursor',
  '[]',
  '[]',
  1
FROM users;

-- Codex provider defaults
INSERT OR IGNORE INTO user_settings (user_id, provider, allowed_tools, disallowed_tools, skip_permissions)
SELECT
  id,
  'codex',
  '[]',
  '[]',
  1
FROM users;

-- ====================================================================
-- Migration Complete
-- ====================================================================
-- To verify the migration:
-- SELECT * FROM user_settings;
-- SELECT * FROM user_mcp_servers;
