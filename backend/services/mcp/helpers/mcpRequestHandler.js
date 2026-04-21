/**
 * mcpRequestHandler.js
 *
 * Handles JSON-RPC request sending for MCP clients
 * Extracted from McpClient to reduce complexity
 *
 * @module services/mcp/helpers/mcpRequestHandler
 */

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/mcp/mcpRequestHandler');

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Build a JSON-RPC 2.0 request object
 * @param {string} method - RPC method name
 * @param {Object} params - Method parameters
 * @param {number} id - Request ID
 * @returns {Object} JSON-RPC request
 */
export function buildJsonRpcRequest(method, params, id) {
  return {
    jsonrpc: '2.0',
    id,
    method,
    params
  };
}

/**
 * Send a JSON-RPC request via stdio transport
 * @param {Object} process - Child process with stdin
 * @param {Object} client - McpClient instance (EventEmitter)
 * @param {Object} request - JSON-RPC request object
 * @returns {Promise<Object>} Response result
 */
export function sendStdioRequest(process, client, request) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, REQUEST_TIMEOUT_MS);

    const messageHandler = (msg) => {
      if (msg.id === request.id) {
        clearTimeout(timeout);
        client.removeListener('message', messageHandler);

        if (msg.error) {
          reject(new Error(msg.error.message));
        } else {
          resolve(msg.result);
        }
      }
    };

    client.on('message', messageHandler);
    process.stdin.write(JSON.stringify(request) + '\n');
  });
}

/**
 * Build the MCP initialize params
 * @returns {Object} Initialize params
 */
export function buildInitializeParams() {
  return {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'claude-code-ui',
      version: '1.0.0'
    }
  };
}

/**
 * Build test result object
 * @param {boolean} success - Whether test succeeded
 * @param {string} status - Status string
 * @param {string} message - Result message
 * @param {Object} server - Server config
 * @param {Object} [extra] - Extra fields to merge
 * @returns {Object} Test result
 */
export function buildTestResult(success, status, message, server, extra = {}) {
  return {
    success,
    status,
    message,
    serverName: server.name,
    serverType: server.type,
    ...extra
  };
}
