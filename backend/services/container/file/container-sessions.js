/**
 * 容器会话读取模块
 *
 * 从 Docker 容器内读取 Claude Code 会话信息
 * 支持 CONTAINER_MODE=1 开关
 *
 * Session 存储位置：/workspace/.claude/projects/{projectName}/
 * 项目名称编码：my-workspace → -workspace-my-workspace
 */

import containerManager from '../core/index.js';
import { CONTAINER } from '../../../config/config.js';

/**
 * 编码项目名称为容器内存储格式
 *
 * SDK 基于绝对路径进行编码：
 * - /workspace/my-workspace → -workspace-my-workspace
 * - workspace/my-workspace → -workspace-my-workspace
 *
 * @param {string} projectName - 项目名称 (如: my-workspace)
 * @returns {string} 编码后的名称 (如: -workspace-my-workspace)
 */
function encodeProjectName(projectName) {
  // SDK 编码的是完整路径 "workspace/my-workspace"
  // 所以我们需要添加 workspace 前缀后再编码
  const fullPath = `workspace/${projectName}`;
  return fullPath.replace(/\//g, '-').replace(/^/, '-');
}

/**
 * 从容器内读取 JSONL 文件内容
 * @param {number} userId - 用户 ID
 * @param {string} filePath - 容器内文件路径
 * @returns {Promise<string>} 文件内容
 */
async function readFileFromContainer(userId, filePath) {
  const { stream } = await containerManager.execInContainer(
    userId,
    `cat "${filePath}"`
  );

  // 使用 demuxStream 来正确处理 Docker 的多路复用协议
  const { PassThrough } = await import('stream');
  const stdout = new PassThrough();
  const stderr = new PassThrough();

  containerManager.docker.modem.demuxStream(stream, stdout, stderr);

  return new Promise((resolve, reject) => {
    let content = '';
    let errorOutput = '';

    stdout.on('data', (chunk) => {
      content += chunk.toString();
    });

    stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });

    stream.on('error', (err) => {
      reject(new Error(`Failed to read file: ${err.message}`));
    });

    stream.on('end', () => {
      if (errorOutput && (errorOutput.includes('No such file') || errorOutput.includes('cannot access'))) {
        reject(new Error(`File not found: ${filePath}`));
      } else {
        resolve(content);
      }
    });
  });
}

/**
 * 解析 JSONL 文件中的会话数据（从主机模式的 sessions.js 复用）
 * @param {string} content - JSONL 文件内容
 * @returns {Object} 包含会话和条目的对象
 */
function parseJsonlContent(content) {
  const sessions = new Map();
  const entries = [];
  const pendingSummaries = new Map();

  try {
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.trim()) {
        try {
          const entry = JSON.parse(line);
          entries.push(entry);

          // Handle summary entries
          if (entry.type === 'summary' && entry.summary && !entry.sessionId && entry.leafUuid) {
            pendingSummaries.set(entry.leafUuid, entry.summary);
          }

          if (entry.sessionId) {
            if (!sessions.has(entry.sessionId)) {
              sessions.set(entry.sessionId, {
                id: entry.sessionId,
                summary: 'New Session',
                messageCount: 0,
                lastActivity: new Date(),
                cwd: entry.cwd || '',
                lastUserMessage: null,
                lastAssistantMessage: null
              });
            }

            const session = sessions.get(entry.sessionId);

            // Apply pending summary
            if (session.summary === 'New Session' && entry.parentUuid && pendingSummaries.has(entry.parentUuid)) {
              session.summary = pendingSummaries.get(entry.parentUuid);
            }

            // Update summary from summary entries
            if (entry.type === 'summary' && entry.summary) {
              session.summary = entry.summary;
            }

            // Track user messages
            if (entry.message?.role === 'user' && entry.message?.content) {
              const content = entry.message.content;

              let textContent = content;
              if (Array.isArray(content) && content.length > 0 && content[0].type === 'text') {
                textContent = content[0].text;
              }

              const isSystemMessage = typeof textContent === 'string' && (
                textContent.startsWith('<command-name>') ||
                textContent.startsWith('<command-message>') ||
                textContent.startsWith('<command-args>') ||
                textContent.startsWith('<local-command-stdout>') ||
                textContent.startsWith('<system-reminder>') ||
                textContent.startsWith('Caveat:') ||
                textContent.startsWith('This session is being continued from a previous') ||
                textContent.startsWith('Invalid API key') ||
                textContent.includes('{"subtasks":') ||
                textContent.includes('CRITICAL: You MUST respond with ONLY a JSON') ||
                textContent === 'Warmup'
              );

              if (typeof textContent === 'string' && textContent.length > 0 && !isSystemMessage) {
                session.lastUserMessage = textContent;
              }
            } else if (entry.message?.role === 'assistant' && entry.message?.content) {
              if (entry.isApiErrorMessage === true) {
                // Skip
              } else {
                let assistantText = null;

                if (Array.isArray(entry.message.content)) {
                  for (const part of entry.message.content) {
                    if (part.type === 'text' && part.text) {
                      assistantText = part.text;
                    }
                  }
                } else if (typeof entry.message.content === 'string') {
                  assistantText = entry.message.content;
                }

                const isSystemAssistantMessage = typeof assistantText === 'string' && (
                  assistantText.startsWith('Invalid API key') ||
                  assistantText.includes('{"subtasks":') ||
                  assistantText.includes('CRITICAL: You MUST respond with ONLY a JSON')
                );

                if (assistantText && !isSystemAssistantMessage) {
                  session.lastAssistantMessage = assistantText;
                }
              }
            }

            session.messageCount++;

            if (entry.timestamp) {
              session.lastActivity = new Date(entry.timestamp);
            }
          }
        } catch (parseError) {
          // Skip malformed lines
        }
      }
    }

    // Set final summary based on last message if no summary exists
    for (const session of sessions.values()) {
      if (session.summary === 'New Session') {
        const lastMessage = session.lastUserMessage || session.lastAssistantMessage;
        if (lastMessage) {
          session.summary = lastMessage.length > 50 ? lastMessage.substring(0, 50) + '...' : lastMessage;
        }
      }
    }

    // Filter out sessions with JSON responses (Task Master errors)
    const allSessions = Array.from(sessions.values());
    const filteredSessions = allSessions.filter(session => {
      const shouldFilter = session.summary.startsWith('{ "');
      return !shouldFilter;
    });

    return {
      sessions: filteredSessions,
      entries: entries
    };

  } catch (error) {
    console.error('Error parsing JSONL content:', error);
    return { sessions: [], entries: [] };
  }
}

/**
 * 从容器内列出项目的会话文件
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @returns {Promise<Array>} 会话文件列表
 */
async function listSessionFiles(userId, projectName) {
  const encodedProjectName = encodeProjectName(projectName);
  const projectDir = `${CONTAINER.paths.projects}/${encodedProjectName}`;

  console.log(`[ContainerSessions] Listing files in: ${projectDir}`);

  // 使用 for 循环查找所有 .jsonl 文件（更可靠）
  const { stream } = await containerManager.execInContainer(
    userId,
    `for f in "${projectDir}"/*.jsonl; do [ -f "$f" ] && basename "$f"; done 2>/dev/null || echo ""`
  );

  // 使用 demuxStream 来正确处理 Docker 的多路复用协议
  const { PassThrough } = await import('stream');
  const stdout = new PassThrough();
  const stderr = new PassThrough();

  containerManager.docker.modem.demuxStream(stream, stdout, stderr);

  return new Promise((resolve) => {
    let output = '';

    stdout.on('data', (chunk) => {
      output += chunk.toString();
      console.log(`[ContainerSessions] STDOUT chunk:`, JSON.stringify(chunk.toString()));
    });

    stderr.on('data', (chunk) => {
      console.log(`[ContainerSessions] STDERR while listing files:`, chunk.toString());
    });

    stream.on('error', (err) => {
      // Directory might not exist, return empty array
      console.log(`[ContainerSessions] Error listing files:`, err.message);
      resolve([]);
    });

    stream.on('end', () => {
      try {
        const files = output.trim().split('\n').filter(f => f.trim());
        // 过滤掉 agent-*.jsonl 文件
        const sessionFiles = files.filter(f =>
          f.endsWith('.jsonl') && !f.startsWith('agent-')
        );
        console.log(`[ContainerSessions] Found session files:`, sessionFiles);
        resolve(sessionFiles);
      } catch (e) {
        console.log(`[ContainerSessions] Error parsing file list:`, e.message);
        resolve([]);
      }
    });
  });
}

/**
 * 获取项目的会话列表（容器模式）
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @param {number} limit - 返回的会话数量限制
 * @param {number} offset - 分页偏移量
 * @returns {Promise<Object>} 会话列表和分页信息
 */
async function getSessionsInContainer(userId, projectName, limit = 5, offset = 0) {
  console.log(`[ContainerSessions] Getting sessions for project: ${projectName}`);

  try {
    // 获取会话文件列表
    const sessionFiles = await listSessionFiles(userId, projectName);

    if (sessionFiles.length === 0) {
      console.log(`[ContainerSessions] No session files found for project: ${projectName}`);
      return { sessions: [], hasMore: false, total: 0 };
    }

    console.log(`[ContainerSessions] Found ${sessionFiles.length} session files`);

    // 读取所有会话文件
    const allSessions = new Map();
    const allEntries = [];

    for (const fileName of sessionFiles) {
      try {
        const encodedProjectName = encodeProjectName(projectName);
        const filePath = `${CONTAINER.paths.projects}/${encodedProjectName}/${fileName}`;
        const content = await readFileFromContainer(userId, filePath);

        const result = parseJsonlContent(content);

        result.sessions.forEach(session => {
          if (!allSessions.has(session.id)) {
            allSessions.set(session.id, session);
          }
        });

        allEntries.push(...result.entries);
      } catch (error) {
        console.warn(`[ContainerSessions] Failed to read session file ${fileName}:`, error.message);
      }
    }

    // 构建会话分组（与主机模式相同逻辑）
    const sessionGroups = new Map();
    const sessionToFirstUserMsgId = new Map();

    allEntries.forEach(entry => {
      if (entry.sessionId && entry.type === 'user' && entry.parentUuid === null && entry.uuid) {
        const firstUserMsgId = entry.uuid;

        if (!sessionToFirstUserMsgId.has(entry.sessionId)) {
          sessionToFirstUserMsgId.set(entry.sessionId, firstUserMsgId);

          const session = allSessions.get(entry.sessionId);
          if (session) {
            if (!sessionGroups.has(firstUserMsgId)) {
              sessionGroups.set(firstUserMsgId, {
                latestSession: session,
                allSessions: [session]
              });
            } else {
              const group = sessionGroups.get(firstUserMsgId);
              group.allSessions.push(session);

              if (new Date(session.lastActivity) > new Date(group.latestSession.lastActivity)) {
                group.latestSession = session;
              }
            }
          }
        }
      }
    });

    // 收集独立会话
    const groupedSessionIds = new Set();
    sessionGroups.forEach(group => {
      group.allSessions.forEach(session => groupedSessionIds.add(session.id));
    });

    const standaloneSessions = Array.from(allSessions.values())
      .filter(session => !groupedSessionIds.has(session.id));

    // 合并分组会话和独立会话
    const latestFromGroups = Array.from(sessionGroups.values()).map(group => {
      const session = { ...group.latestSession };
      if (group.allSessions.length > 1) {
        session.isGrouped = true;
        session.groupSize = group.allSessions.length;
        session.groupSessions = group.allSessions.map(s => s.id);
      }
      return session;
    });

    const visibleSessions = [...latestFromGroups, ...standaloneSessions]
      .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

    const total = visibleSessions.length;
    const paginatedSessions = visibleSessions.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    console.log(`[ContainerSessions] Returning ${paginatedSessions.length} sessions (total: ${total})`);

    return {
      sessions: paginatedSessions,
      hasMore,
      total,
      offset,
      limit
    };

  } catch (error) {
    console.error(`[ContainerSessions] Error getting sessions for project ${projectName}:`, error);
    return { sessions: [], hasMore: false, total: 0 };
  }
}

/**
 * 获取项目的所有会话文件（用于调试）
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @returns {Promise<Array>} 会话文件信息列表
 */
async function getSessionFilesInfo(userId, projectName) {
  try {
    const encodedProjectName = encodeProjectName(projectName);
    const projectDir = `${CONTAINER.paths.projects}/${encodedProjectName}`;

    const { stream } = await containerManager.execInContainer(
      userId,
      `ls -la "${projectDir}" 2>/dev/null || echo "Directory not found"`
    );

    // 使用 demuxStream 来正确处理 Docker 的多路复用协议
    const { PassThrough } = await import('stream');
    const stdout = new PassThrough();
    const stderr = new PassThrough();

    containerManager.docker.modem.demuxStream(stream, stdout, stderr);

    return new Promise((resolve) => {
      let output = '';
      let errorOutput = '';

      stdout.on('data', (chunk) => {
        output += chunk.toString();
      });

      stderr.on('data', (chunk) => {
        errorOutput += chunk.toString();
        console.log(`[ContainerSessions] STDERR while getting files info:`, chunk.toString());
      });

      stream.on('error', () => {
        resolve('');
      });

      stream.on('end', () => {
        resolve(output);
      });
    });
  } catch (error) {
    console.error(`[ContainerSessions] Error getting session files info:`, error);
    return '';
  }
}

/**
 * 从容器内获取特定会话的消息（支持分页）
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @param {string} sessionId - 会话 ID
 * @param {number|null} limit - 消息数量限制（null 表示返回全部）
 * @param {number} offset - 分页偏移量
 * @returns {Promise<Object|Array>} 消息列表和分页信息，或全部消息
 */
async function getSessionMessagesInContainer(userId, projectName, sessionId, limit = null, offset = 0) {
  console.log(`[ContainerSessions] Getting messages for session: ${sessionId} in project: ${projectName}`);

  try {
    const encodedProjectName = encodeProjectName(projectName);
    const projectDir = `${CONTAINER.paths.projects}/${encodedProjectName}`;

    // 获取会话文件列表
    const sessionFiles = await listSessionFiles(userId, projectName);

    if (sessionFiles.length === 0) {
      return { messages: [], total: 0, hasMore: false };
    }

    const messages = [];

    // 读取所有会话文件以查找该 session 的消息
    for (const fileName of sessionFiles) {
      try {
        const filePath = `${projectDir}/${fileName}`;
        const content = await readFileFromContainer(userId, filePath);

        // 解析 JSONL 内容
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              const entry = JSON.parse(line);
              if (entry.sessionId === sessionId) {
                messages.push(entry);
              }
            } catch (parseError) {
              // 跳过格式错误的行
            }
          }
        }
      } catch (error) {
        console.warn(`[ContainerSessions] Failed to read session file ${fileName}:`, error.message);
      }
    }

    // 按时间戳排序
    messages.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeA - timeB;
    });

    // 处理分页
    const total = messages.length;
    const hasMore = limit !== null && offset + limit < total;

    if (limit === null) {
      // 返回全部消息（向后兼容）
      return messages;
    } else {
      // 返回分页消息
      const paginatedMessages = messages.slice(offset, offset + limit);
      return {
        messages: paginatedMessages,
        total,
        hasMore,
        offset,
        limit
      };
    }
  } catch (error) {
    console.error(`[ContainerSessions] Error getting session messages:`, error);
    return { messages: [], total: 0, hasMore: false };
  }
}

export {
  encodeProjectName,
  readFileFromContainer,
  parseJsonlContent,
  getSessionsInContainer,
  getSessionFilesInfo,
  getSessionMessagesInContainer
};
