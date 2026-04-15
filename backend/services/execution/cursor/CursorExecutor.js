import { spawn } from 'child_process';
import crossSpawn from 'cross-spawn';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/execution/cursor/CursorExecutor');

// 在 Windows 上使用 cross-spawn 以获得更好的命令执行
const spawnFunction = process.platform === 'win32' ? crossSpawn : spawn;

let activeCursorProcesses = new Map(); // 按会话 ID 跟踪活动进程

async function spawnCursor(command, options = {}, ws) {
  return new Promise(async (resolve, reject) => {
    const { sessionId, projectPath, cwd, resume, toolsSettings, skipPermissions, model, images } = options;
    let capturedSessionId = sessionId; // 在整个过程中跟踪会话 ID
    let sessionCreatedSent = false; // 跟踪我们是否已经发送了 session-created 事件
    let messageBuffer = ''; // 用于累积助手消息的缓冲区

    // 使用前端传递的工具设置，或使用默认值
    const settings = toolsSettings || {
      allowedShellCommands: [],
      skipPermissions: false
    };

    // 构建 Cursor CLI 命令
    const args = [];

    // 构建允许同时恢复和提示的标志（在现有会话中回复）
    // 将 sessionId 的存在视为恢复的意图，无论 resume 标志如何
    if (sessionId) {
      args.push('--resume=' + sessionId);
    }

    if (command && command.trim()) {
      // 提供提示（对新会话和恢复的会话都有效）
      args.push('-p', command);

      // 如果指定了模型标志，则添加（仅对新会话有意义；对恢复无影响）
      if (!sessionId && model) {
        args.push('--model', model);
      }

      // 当我们提供提示时，请求流式 JSON
      args.push('--output-format', 'stream-json');
    }

    // 如果启用，则添加跳过权限标志
    if (skipPermissions || settings.skipPermissions) {
      args.push('-f');
      logger.info('⚠️  Using -f flag (skip permissions)');
    }

    // 使用 cwd（实际项目目录）而不是 projectPath
    const workingDir = cwd || projectPath || process.cwd();

    logger.info('Spawning Cursor CLI:', 'cursor-agent', args.join(' '));
    logger.info('Working directory:', workingDir);
    logger.info('Session info - Input sessionId:', sessionId, 'Resume:', resume);
    
    const cursorProcess = spawnFunction('cursor-agent', args, {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env } // 继承所有环境变量
    });

    // 存储进程引用以潜在地中止
    const processKey = capturedSessionId || Date.now().toString();
    activeCursorProcesses.set(processKey, cursorProcess);

    // 处理 stdout（流式 JSON 响应）
    cursorProcess.stdout.on('data', (data) => {
      const rawOutput = data.toString();
      logger.info('📤 Cursor CLI stdout:', rawOutput);
      
      const lines = rawOutput.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          logger.info('📄 Parsed JSON response:', response);
          
          // 处理不同的消息类型
          switch (response.type) {
            case 'system':
              if (response.subtype === 'init') {
                // 捕获会话 ID
                if (response.session_id && !capturedSessionId) {
                  capturedSessionId = response.session_id;
                  logger.info('📝 Captured session ID:', capturedSessionId);

                  // 使用捕获的会话 ID 更新进程键
                  if (processKey !== capturedSessionId) {
                    activeCursorProcesses.delete(processKey);
                    activeCursorProcesses.set(capturedSessionId, cursorProcess);
                  }

                  // 在 writer 上设置会话 ID（用于 API 端点兼容性）
                  if (ws.setSessionId && typeof ws.setSessionId === 'function') {
                    ws.setSessionId(capturedSessionId);
                  }

                  // 仅为新会话发送一次 session-created 事件
                  if (!sessionId && !sessionCreatedSent) {
                    sessionCreatedSent = true;
                    ws.send({
                      type: 'session-created',
                      sessionId: capturedSessionId,
                      model: response.model,
                      cwd: response.cwd
                    });
                  }
                }

                // 向前端发送系统信息
                ws.send({
                  type: 'cursor-system',
                  data: response
                });
              }
              break;

            case 'user':
              // 转发用户消息
              ws.send({
                type: 'cursor-user',
                data: response
              });
              break;

            case 'assistant':
              // 累积助手消息块
              if (response.message && response.message.content && response.message.content.length > 0) {
                const textContent = response.message.content[0].text;
                messageBuffer += textContent;

                // 作为 Claude 兼容格式发送到前端
                ws.send({
                  type: 'claude-response',
                  data: {
                    type: 'content_block_delta',
                    delta: {
                      type: 'text_delta',
                      text: textContent
                    }
                  }
                });
              }
              break;

            case 'result':
              // 会话完成
              logger.info('Cursor session result:', response);

              // 如果我们有缓冲内容，则发送最终消息
              if (messageBuffer) {
                ws.send({
                  type: 'claude-response',
                  data: {
                    type: 'content_block_stop'
                  }
                });
              }

              // 发送完成事件
              ws.send({
                type: 'cursor-result',
                sessionId: capturedSessionId || sessionId,
                data: response,
                success: response.subtype === 'success'
              });
              break;

            default:
              // 转发任何其他消息类型
              ws.send({
                type: 'cursor-response',
                data: response
              });
          }
        } catch (parseError) {
          logger.info('📄 Non-JSON response:', line);
          // 如果不是 JSON，则作为原始文本发送
          ws.send({
            type: 'cursor-output',
            data: line
          });
        }
      }
    });

    // 处理 stderr
    cursorProcess.stderr.on('data', (data) => {
      logger.error('Cursor CLI stderr:', data.toString());
      ws.send({
        type: 'cursor-error',
        error: data.toString()
      });
    });
    
    // 处理进程完成
    cursorProcess.on('close', async (code) => {
      logger.info(`Cursor CLI process exited with code ${code}`);

      // 清理进程引用
      const finalSessionId = capturedSessionId || sessionId || processKey;
      activeCursorProcesses.delete(finalSessionId);

      ws.send({
        type: 'claude-complete',
        sessionId: finalSessionId,
        exitCode: code,
        isNewSession: !sessionId && !!command // 指示这是一个新会话的标志
      });

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Cursor CLI exited with code ${code}`));
      }
    });

    // 处理进程错误
    cursorProcess.on('error', (error) => {
      logger.error('Cursor CLI process error:', error);

      // 错误时清理进程引用
      const finalSessionId = capturedSessionId || sessionId || processKey;
      activeCursorProcesses.delete(finalSessionId);

      ws.send({
        type: 'cursor-error',
        error: error.message
      });

      reject(error);
    });

    // 关闭 stdin，因为 Cursor 不需要交互式输入
    cursorProcess.stdin.end();
  });
}

function abortCursorSession(sessionId) {
  const process = activeCursorProcesses.get(sessionId);
  if (process) {
    logger.info(`🛑 Aborting Cursor session: ${sessionId}`);
    process.kill('SIGTERM');
    activeCursorProcesses.delete(sessionId);
    return true;
  }
  return false;
}

function isCursorSessionActive(sessionId) {
  return activeCursorProcesses.has(sessionId);
}

function getActiveCursorSessions() {
  return Array.from(activeCursorProcesses.keys());
}

export {
  spawnCursor,
  abortCursorSession,
  isCursorSessionActive,
  getActiveCursorSessions
};