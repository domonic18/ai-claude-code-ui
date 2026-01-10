/**
 * Project Watcher Module
 *
 * Monitors the Claude projects directory for changes and broadcasts
 * updates to connected WebSocket clients.
 *
 * In container mode, file watching is disabled as projects are managed
 * inside Docker containers.
 */

import path from 'path';
import os from 'os';
import { getProjects } from '../services/project/index.js';

/**
 * Setup file system watcher for Claude projects folder using chokidar
 * @param {Set} connectedClients - Set of connected WebSocket clients
 * @returns {Promise<void>}
 */
export async function setupProjectsWatcher(connectedClients) {
  // Check if container mode is enabled
  const isContainerMode = process.env.CONTAINER_MODE === 'true' || process.env.CONTAINER_MODE === '1';

  if (isContainerMode) {
    console.log('[INFO] Container mode is enabled, skipping host projects watcher');
    console.log('[INFO] Projects will be managed inside containers');
    return;
  }

  const chokidar = (await import('chokidar')).default;
  const claudeProjectsPath = path.join(os.homedir(), '.claude', 'projects');

  try {
    // Initialize chokidar watcher with optimized settings
    const projectsWatcher = chokidar.watch(claudeProjectsPath, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/*.tmp',
        '**/*.swp',
        '**/.DS_Store'
      ],
      persistent: true,
      ignoreInitial: true, // Don't fire events for existing files on startup
      followSymlinks: false,
      depth: 10, // Reasonable depth limit
      awaitWriteFinish: {
        stabilityThreshold: 100, // Wait 100ms for file to stabilize
        pollInterval: 50
      }
    });

    // Debounce function to prevent excessive notifications
    let debounceTimer;
    const debouncedUpdate = async (eventType, filePath) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          // Get updated projects list
          const updatedProjects = await getProjects();

          // Notify all connected clients about the project changes
          const updateMessage = JSON.stringify({
            type: 'projects_updated',
            projects: updatedProjects,
            timestamp: new Date().toISOString(),
            changeType: eventType,
            changedFile: path.relative(claudeProjectsPath, filePath)
          });

          connectedClients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
              client.send(updateMessage);
            }
          });

        } catch (error) {
          console.error('[ERROR] Error handling project changes:', error);
        }
      }, 300); // 300ms debounce
    };

    // Set up event listeners
    projectsWatcher
      .on('add', (filePath) => debouncedUpdate('add', filePath))
      .on('change', (filePath) => debouncedUpdate('change', filePath))
      .on('unlink', (filePath) => debouncedUpdate('unlink', filePath))
      .on('addDir', (dirPath) => debouncedUpdate('addDir', dirPath))
      .on('unlinkDir', (dirPath) => debouncedUpdate('unlinkDir', dirPath))
      .on('error', (error) => {
        console.error('[ERROR] Chokidar watcher error:', error);
      })
      .on('ready', () => {
        // Watcher is ready
      });

    console.log('[INFO] Host projects watcher started (non-container mode)');

    return projectsWatcher;

  } catch (error) {
    console.error('[ERROR] Failed to setup projects watcher:', error);
    return null;
  }
}
