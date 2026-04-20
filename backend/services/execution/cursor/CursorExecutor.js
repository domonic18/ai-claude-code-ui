import { spawn } from 'child_process';
import crossSpawn from 'cross-spawn';
import { createLogger, sanitizePreview } from '../../../utils/logger.js';
import { createResponseHandlers } from './cursorResponseHandlers.js';

const logger = createLogger('services/execution/cursor/CursorExecutor');

const spawnFunction = process.platform === 'win32' ? crossSpawn : spawn;
const activeCursorProcesses = new Map();

function buildCursorArgs(command, sessionId, model, skipPermissions, settings) {
  const args = [];

  if (sessionId) args.push('--resume=' + sessionId);
  if (command && command.trim()) {
    args.push('-p', command);
    if (!sessionId && model) args.push('--model', model);
    args.push('--output-format', 'stream-json');
  }
  if (skipPermissions || settings.skipPermissions) {
    args.push('-f');
    logger.info({ sessionId }, '[CursorExecutor] Using -f flag (skip permissions)');
  }

  return args;
}

const RESPONSE_HANDLERS = createResponseHandlers(activeCursorProcesses, logger);

function processStdoutLine(line, context) {
  try {
    const response = JSON.parse(line);
    logger.debug({ sessionId: context.sessionId, responseType: response.type, subtype: response.subtype }, '[CursorExecutor] Parsed response');
    const handler = RESPONSE_HANDLERS[response.type];
    if (handler) handler(response, context);
    else context.ws.send({ type: 'cursor-response', data: response });
  } catch {
    logger.debug({ sessionId: context.sessionId, lineLength: line.length }, '[CursorExecutor] Non-JSON response');
    context.ws.send({ type: 'cursor-output', data: line });
  }
}

async function spawnCursor(command, options = {}, ws) {
  return new Promise(async (resolve, reject) => {
    const { sessionId, projectPath, cwd, toolsSettings, skipPermissions, model } = options;
    const settings = toolsSettings || { allowedShellCommands: [], skipPermissions: false };
    const workingDir = cwd || projectPath || process.cwd();

    const args = buildCursorArgs(command, sessionId, model, skipPermissions, settings);
    logger.info({ sessionId, workingDir, resume: !!sessionId }, '[CursorExecutor] Spawning Cursor CLI');
    logger.debug({ sessionId, commandPreview: sanitizePreview(command), totalLength: command?.length || 0 }, '[CursorExecutor] User command');

    const cursorProcess = spawnFunction('cursor-agent', args, { cwd: workingDir, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } });

    const processKey = sessionId || Date.now().toString();
    activeCursorProcesses.set(processKey, cursorProcess);

    const context = {
      sessionId, capturedSessionId: sessionId, sessionCreatedSent: false,
      messageBuffer: '', processKey, cursorProcess, ws,
    };

    cursorProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      for (const line of lines) processStdoutLine(line, context);
    });

    cursorProcess.stderr.on('data', (data) => {
      logger.error({ sessionId: context.capturedSessionId || sessionId, stderr: data.toString().substring(0, 500) }, '[CursorExecutor] stderr');
      ws.send({ type: 'cursor-error', error: data.toString() });
    });

    cursorProcess.on('close', async (code) => {
      const finalSessionId = context.capturedSessionId || processKey;
      logger.info({ sessionId: finalSessionId, exitCode: code }, '[CursorExecutor] Process exited');
      activeCursorProcesses.delete(finalSessionId);
      ws.send({ type: 'claude-complete', sessionId: finalSessionId, exitCode: code, isNewSession: !sessionId && !!command });
      code === 0 ? resolve() : reject(new Error(`Cursor CLI exited with code ${code}`));
    });

    cursorProcess.on('error', (error) => {
      const finalSessionId = context.capturedSessionId || processKey;
      logger.error({ sessionId: finalSessionId, err: error }, '[CursorExecutor] Process error');
      activeCursorProcesses.delete(finalSessionId);
      ws.send({ type: 'cursor-error', error: error.message });
      reject(error);
    });

    cursorProcess.stdin.end();
  });
}

function abortCursorSession(sessionId) {
  const process = activeCursorProcesses.get(sessionId);
  if (process) {
    logger.info({ sessionId }, '[CursorExecutor] Aborting session');
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

export { spawnCursor, abortCursorSession, isCursorSessionActive, getActiveCursorSessions };
