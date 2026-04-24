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

# ==================== Structured Logging ====================
# 输出 pino 兼容的 JSON 日志，由 Node.js pino 统一采集
log_info() {
    local msg="$1"; shift
    printf '{"level":30,"time":%s,"module":"entrypoint","msg":"%s"' "$(date +%s%3N)" "$msg"
    for kv in "$@"; do printf ',"%s"' "$kv"; done
    printf '}\n'
}

log_debug() {
    local msg="$1"; shift
    printf '{"level":20,"time":%s,"module":"entrypoint","msg":"%s"' "$(date +%s%3N)" "$msg"
    for kv in "$@"; do printf ',"%s"' "$kv"; done
    printf '}\n'
}

# ==================== Functions ====================

# Fix /workspace ownership if running as root
fix_workspace_permissions() {
    if [ "$(id -u)" = '0' ]; then
        # Get node user UID
        NODE_UID=$(id -u node 2>/dev/null || echo 1000)

        # Check if /workspace is owned by node user
        CURRENT_UID=$(stat -c '%u' "$WORKSPACE" 2>/dev/null || stat -f '%u' "$WORKSPACE" 2>/dev/null)

        if [ "$CURRENT_UID" != "$NODE_UID" ]; then
            log_info "Fixing workspace ownership" "\"currentUid\":\"$CURRENT_UID\",\"targetUid\":\"$NODE_UID\""
            chown -R node:node "$WORKSPACE"
        else
            log_debug "Workspace ownership already correct"
        fi

        # Ensure proper permissions
        chmod 755 "$WORKSPACE" 2>/dev/null || true
    fi
}

# Create data directory if it doesn't exist
setup_data_dir() {
    if [ ! -d "$DATA_DIR" ]; then
        log_info "Creating data directory" "\"dataDir\":\"$DATA_DIR\""
        mkdir -p "$DATA_DIR"
    fi
}

# Set permissions for data directory
# Using 777 for maximum compatibility across different file systems and Docker Desktop for Mac
set_data_dir_permissions() {
    chmod -R 777 "$DATA_DIR" 2>/dev/null || true
    log_debug "Data directory permissions set" "\"dataDir\":\"$DATA_DIR\""
}

# Set Docker socket permissions to allow node user access
set_docker_socket_permissions() {
    if [ -S "$DOCKER_SOCKET" ]; then
        chmod 666 "$DOCKER_SOCKET" 2>/dev/null || true
        log_debug "Docker socket permissions set"
    fi
}

# ==================== Main Execution ====================

log_info "Starting Claude Code UI" "\"dataDir\":\"$DATA_DIR\",\"workspace\":\"$WORKSPACE\""

# Order matters: fix permissions first, then setup other directories
fix_workspace_permissions
setup_data_dir
set_data_dir_permissions
set_docker_socket_permissions

log_info "Switching to node user"
exec gosu node node /app/backend/index.js
