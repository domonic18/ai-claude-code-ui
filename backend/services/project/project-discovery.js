/**
 * Claude CLI 项目发现
 *
 * 发现 Claude CLI 项目并获取会话信息
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { extractProjectDirectory } from './utils/index.js';
import { generateDisplayName } from './utils/index.js';
import { loadProjectConfig } from './config/index.js';
import { NativeSessionManager } from '../sessions/managers/NativeSessionManager.js';
import { getCursorSessions } from '../execution/cursor/index.js';
import { getCodexSessions } from '../execution/codex/sessions.js';
import { detectTaskMasterFolder } from './taskmaster/index.js';

// 创建会话管理器实例
const sessionManager = new NativeSessionManager();

/**
 * Helper function to get sessions using new session manager
 * @param {string} projectName - Project name
 * @param {number} limit - Limit number of sessions
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Object>} Session result
 */
async function getSessionsHelper(projectName, limit = 5, offset = 0) {
  return await sessionManager.getSessions(projectName, limit, offset);
}

/**
 * 获取所有 Claude 项目
 * @returns {Promise<Array>} 项目列表
 */
async function getProjects() {
  const claudeDir = path.join(os.homedir(), '.claude', 'projects');
  const config = await loadProjectConfig();
  const projects = [];
  const existingProjects = new Set();

  try {
    // Check if the .claude/projects directory exists
    await fs.access(claudeDir);

    // First, get existing Claude projects from the file system
    const entries = await fs.readdir(claudeDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        existingProjects.add(entry.name);
        const projectPath = path.join(claudeDir, entry.name);

        // Extract actual project directory from JSONL sessions
        const actualProjectDir = await extractProjectDirectory(entry.name);

        // Get display name from config or generate one
        const customName = config[entry.name]?.displayName;
        const autoDisplayName = await generateDisplayName(entry.name, actualProjectDir);
        const fullPath = actualProjectDir;

        const project = {
          name: entry.name,
          path: actualProjectDir,
          displayName: customName || autoDisplayName,
          fullPath: fullPath,
          isCustomName: !!customName,
          sessions: []
        };

        // Try to get sessions for this project (just first 5 for performance)
        try {
          const sessionResult = await getSessionsHelper(entry.name, 5, 0);
          project.sessions = sessionResult.sessions || [];
          project.sessionMeta = {
            hasMore: sessionResult.hasMore,
            total: sessionResult.total
          };
        } catch (e) {
          console.warn(`Could not load sessions for project ${entry.name}:`, e.message);
        }

        // Also fetch Cursor sessions for this project
        try {
          project.cursorSessions = await getCursorSessions(actualProjectDir);
        } catch (e) {
          console.warn(`Could not load Cursor sessions for project ${entry.name}:`, e.message);
          project.cursorSessions = [];
        }

        // Also fetch Codex sessions for this project
        try {
          project.codexSessions = await getCodexSessions(actualProjectDir);
        } catch (e) {
          console.warn(`Could not load Codex sessions for project ${entry.name}:`, e.message);
          project.codexSessions = [];
        }

        // Add TaskMaster detection
        try {
          const taskMasterResult = await detectTaskMasterFolder(actualProjectDir);
          project.taskmaster = {
            hasTaskmaster: taskMasterResult.hasTaskmaster,
            hasEssentialFiles: taskMasterResult.hasEssentialFiles,
            metadata: taskMasterResult.metadata,
            status: taskMasterResult.hasTaskmaster && taskMasterResult.hasEssentialFiles ? 'configured' : 'not-configured'
          };
        } catch (e) {
          console.warn(`Could not detect TaskMaster for project ${entry.name}:`, e.message);
          project.taskmaster = {
            hasTaskmaster: false,
            hasEssentialFiles: false,
            metadata: null,
            status: 'error'
          };
        }

        projects.push(project);
      }
    }
  } catch (error) {
    // If the directory doesn't exist (ENOENT), that's okay - just continue with empty projects
    if (error.code !== 'ENOENT') {
      console.error('Error reading projects directory:', error);
    }
  }

  // Add manually configured projects that don't exist as folders yet
  for (const [projectName, projectConfig] of Object.entries(config)) {
    if (!existingProjects.has(projectName) && projectConfig.manuallyAdded) {
      // Use the original path if available, otherwise extract from potential sessions
      let actualProjectDir = projectConfig.originalPath;

      if (!actualProjectDir) {
        try {
          actualProjectDir = await extractProjectDirectory(projectName);
        } catch (error) {
          // Fall back to decoded project name
          actualProjectDir = projectName.replace(/-/g, '/');
        }
      }

      const project = {
        name: projectName,
        path: actualProjectDir,
        displayName: projectConfig.displayName || await generateDisplayName(projectName, actualProjectDir),
        fullPath: actualProjectDir,
        isCustomName: !!projectConfig.displayName,
        isManuallyAdded: true,
        sessions: [],
        cursorSessions: [],
        codexSessions: []
      };

      // Try to fetch Cursor sessions for manual projects too
      try {
        project.cursorSessions = await getCursorSessions(actualProjectDir);
      } catch (e) {
        console.warn(`Could not load Cursor sessions for manual project ${projectName}:`, e.message);
      }

      // Try to fetch Codex sessions for manual projects too
      try {
        project.codexSessions = await getCodexSessions(actualProjectDir);
      } catch (e) {
        console.warn(`Could not load Codex sessions for manual project ${projectName}:`, e.message);
      }

      // Add TaskMaster detection for manual projects
      try {
        const taskMasterResult = await detectTaskMasterFolder(actualProjectDir);

        // Determine TaskMaster status
        let taskMasterStatus = 'not-configured';
        if (taskMasterResult.hasTaskmaster && taskMasterResult.hasEssentialFiles) {
          taskMasterStatus = 'taskmaster-only'; // We don't check MCP for manual projects in bulk
        }

        project.taskmaster = {
          status: taskMasterStatus,
          hasTaskmaster: taskMasterResult.hasTaskmaster,
          hasEssentialFiles: taskMasterResult.hasEssentialFiles,
          metadata: taskMasterResult.metadata
        };
      } catch (error) {
        console.warn(`TaskMaster detection failed for manual project ${projectName}:`, error.message);
        project.taskmaster = {
          status: 'error',
          hasTaskmaster: false,
          hasEssentialFiles: false,
          error: error.message
        };
      }

      projects.push(project);
    }
  }

  return projects;
}

export {
  getProjects
};
