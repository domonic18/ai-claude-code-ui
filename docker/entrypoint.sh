#!/bin/bash
# Claude Code UI - Container Entrypoint Script
#
# This script handles Docker socket permissions and data directory setup
# before starting the application as the non-root node user.

set -e

# ==================== Configuration ====================
DATA_DIR=${DATA_DIR:-/var/lib/claude-code}
DOCKER_SOCKET=/var/run/docker.sock

# ==================== Functions ====================

# Create data directory if it doesn't exist
setup_data_dir() {
    if [ ! -d "$DATA_DIR" ]; then
        echo "[ENTRYPOINT] Creating data directory: $DATA_DIR"
        mkdir -p "$DATA_DIR"
    fi
}

# Set permissions for data directory
# Using 777 for maximum compatibility across different file systems and Docker Desktop for Mac
set_data_dir_permissions() {
    echo "[ENTRYPOINT] Setting permissions for $DATA_DIR"
    chmod -R 777 "$DATA_DIR" 2>/dev/null || true
    ls -la "$DATA_DIR" || true
}

# Set Docker socket permissions to allow node user access
set_docker_socket_permissions() {
    if [ -S "$DOCKER_SOCKET" ]; then
        echo "[ENTRYPOINT] Setting Docker socket permissions"
        chmod 666 "$DOCKER_SOCKET" 2>/dev/null || true
    fi
}

# ==================== Main Execution ====================

echo "[ENTRYPOINT] Starting Claude Code UI..."
echo "[ENTRYPOINT] DATA_DIR=$DATA_DIR"
echo "[ENTRYPOINT] WORKSPACE_DIR=$WORKSPACE_DIR"

setup_data_dir
set_data_dir_permissions
set_docker_socket_permissions

echo "[ENTRYPOINT] Starting application as node user..."
exec gosu node node /app/backend/index.js
