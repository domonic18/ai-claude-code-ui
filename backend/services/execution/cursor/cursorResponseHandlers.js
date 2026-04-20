/**
 * Cursor CLI Response Handler Functions
 *
 * Extracted response handling logic from CursorExecutor.
 */

/**
 * Handle system init response
 * @param {Object} response - Parsed response
 * @param {Object} context - Execution context
 * @param {Map} activeCursorProcesses - Active processes map
 */
function handleSystemInit(response, context, activeCursorProcesses) {
  if (!response.session_id || context.capturedSessionId) return;
  context.capturedSessionId = response.session_id;

  if (context.processKey !== context.capturedSessionId) {
    activeCursorProcesses.delete(context.processKey);
    activeCursorProcesses.set(context.capturedSessionId, context.cursorProcess);
  }

  if (context.ws.setSessionId && typeof context.ws.setSessionId === 'function') {
    context.ws.setSessionId(context.capturedSessionId);
  }

  if (!context.sessionId && !context.sessionCreatedSent) {
    context.sessionCreatedSent = true;
    context.ws.send({
      type: 'session-created',
      sessionId: context.capturedSessionId,
      model: response.model,
      cwd: response.cwd
    });
  }
}

/**
 * Handle assistant message response
 * @param {Object} response - Parsed response
 * @param {Object} context - Execution context
 */
function handleAssistantMessage(response, context) {
  if (!response.message?.content?.length) return;
  const textContent = response.message.content[0].text;
  context.messageBuffer += textContent;
  context.ws.send({
    type: 'claude-response',
    data: {
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: textContent }
    },
  });
}

/**
 * Handle result message response
 * @param {Object} response - Parsed response
 * @param {Object} context - Execution context
 * @param {Function} logger - Logger function
 */
function handleResultMessage(response, context, logger) {
  const sid = context.capturedSessionId || context.sessionId;

  if (context.messageBuffer) {
    context.ws.send({ type: 'claude-response', data: { type: 'content_block_stop' } });
  }

  context.ws.send({
    type: 'cursor-result',
    sessionId: sid,
    data: response,
    success: response.subtype === 'success'
  });
}

/**
 * Create response handlers lookup table
 * @param {Map} activeCursorProcesses - Active processes map
 * @param {Function} logger - Logger function
 * @returns {Object} Response handlers map
 */
function createResponseHandlers(activeCursorProcesses, logger) {
  return {
    system(response, context) {
      if (response.subtype === 'init') {
        handleSystemInit(response, context, activeCursorProcesses);
        context.ws.send({ type: 'cursor-system', data: response });
      }
    },
    user(response, context) {
      context.ws.send({ type: 'cursor-user', data: response });
    },
    assistant(response, context) {
      handleAssistantMessage(response, context);
    },
    result(response, context) {
      handleResultMessage(response, context, logger);
    },
  };
}

export {
  handleSystemInit,
  handleAssistantMessage,
  handleResultMessage,
  createResponseHandlers
};
