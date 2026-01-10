-- Migration: Create user_containers and container_metrics tables
-- Description: Tables for tracking user containers and their resource usage
-- Version: 002

-- User containers table
-- Tracks the Docker containers created for each user
CREATE TABLE IF NOT EXISTS user_containers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  container_id TEXT NOT NULL UNIQUE,
  container_name TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
  resource_usage TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for user_containers
CREATE INDEX IF NOT EXISTS idx_user_containers_user_id ON user_containers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_containers_status ON user_containers(status);
CREATE INDEX IF NOT EXISTS idx_user_containers_last_active ON user_containers(last_active);

-- Container metrics table
-- Records historical resource usage data for containers
CREATE TABLE IF NOT EXISTS container_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  container_id TEXT NOT NULL,
  cpu_percent REAL,
  memory_used INTEGER,
  memory_limit INTEGER,
  memory_percent REAL,
  disk_used INTEGER,
  network_rx INTEGER,
  network_tx INTEGER,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (container_id) REFERENCES user_containers(container_id) ON DELETE CASCADE
);

-- Indexes for container_metrics
CREATE INDEX IF NOT EXISTS idx_container_metrics_container_id ON container_metrics(container_id);
CREATE INDEX IF NOT EXISTS idx_container_metrics_recorded_at ON container_metrics(recorded_at);
