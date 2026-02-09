#!/bin/bash
# Claude Code UI - Container Entrypoint Script
#
# This script handles:
# - /workspace permissions (fixes ownership for node user)
# - Docker socket permissions
# - Data directory setup
# - Switches to node user for application execution

set -e

# ==================== Configuration ====================
DATA_DIR=${DATA_DIR:-/var/lib/claude-code}
DOCKER_SOCKET=/var/run/docker.sock
WORKSPACE=${WORKSPACE:-/workspace}

# ==================== Functions ====================

# Fix /workspace ownership if running as root
fix_workspace_permissions() {
    if [ "$(id -u)" = '0' ]; then
        echo "[ENTRYPOINT] Running as root, fixing /workspace permissions..."

        # Get node user UID
        NODE_UID=$(id -u node 2>/dev/null || echo 1000)

        # Check if /workspace is owned by node user
        CURRENT_UID=$(stat -c '%u' "$WORKSPACE" 2>/dev/null || stat -f '%u' "$WORKSPACE" 2>/dev/null)

        if [ "$CURRENT_UID" != "$NODE_UID" ]; then
            echo "[ENTRYPOINT] Changing /workspace ownership to node:node (current: $CURRENT_UID, target: $NODE_UID)"
            chown -R node:node "$WORKSPACE"
        else
            echo "[ENTRYPOINT] /workspace already owned by node user"
        fi

        # Ensure proper permissions
        chmod 755 "$WORKSPACE" 2>/dev/null || true
    else
        echo "[ENTRYPOINT] Not running as root, skipping permission fix"
    fi
}

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
echo "[ENTRYPOINT] WORKSPACE=$WORKSPACE"

# Order matters: fix permissions first, then setup other directories
fix_workspace_permissions
setup_data_dir
set_data_dir_permissions
set_docker_socket_permissions

echo "[ENTRYPOINT] Starting application as node user..."
exec gosu node node /app/backend/index.js
