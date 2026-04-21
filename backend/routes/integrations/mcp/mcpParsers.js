/**
 * MCP Output Parsers
 *
 * Parse output from Claude CLI MCP commands.
 *
 * @module routes/integrations/mcp/mcpParsers
 */

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('mcp/parsers');

/**
 * Parse a single server line from `claude mcp list` output
 * @param {string} line - A line containing server name and details
 * @returns {Object|null} Parsed server info, or null to skip
 */
function parseListLine(line) {
  if (!line.includes(':')) return null;

  const colonIndex = line.indexOf(':');
  const name = line.substring(0, colonIndex).trim();
  if (!name) return null;

  const rest = line.substring(colonIndex + 1).trim();
  let description = rest;
  let status = 'unknown';

  if (rest.includes('\u2713') || rest.includes('\u2717')) {
    const statusMatch = rest.match(/(.*?)\s*-\s*([\u2713\u2717].*)$/);
    if (statusMatch) {
      description = statusMatch[1].trim();
      status = statusMatch[2].includes('\u2713') ? 'connected' : 'failed';
    }
  }

  const type = (description.startsWith('http://') || description.startsWith('https://')) ? 'http' : 'stdio';

  return { name, type, status: status || 'active', description };
}

/**
 * Parse output from `claude mcp list` command
 * Extracts server names, types, statuses, and descriptions
 *
 * @param {string} output - Raw CLI output
 * @returns {Array<{name: string, type: string, status: string, description: string}>}
 */
export function parseClaudeListOutput(output) {
  const servers = output
    .split('\n')
    .filter(line => line.trim() && !line.includes('Checking MCP server health'))
    .map(parseListLine)
    .filter(Boolean);

  logger.info('Parsed Claude CLI servers:', servers);
  return servers;
}

/**
 * Parse output from `claude mcp get <name>` command
 * Attempts JSON extraction first, falls back to text parsing
 *
 * @param {string} output - Raw CLI output
 * @returns {object} Parsed server details
 */
export function parseClaudeGetOutput(output) {
  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    const server = { raw_output: output };
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('Name:')) {
        server.name = line.split(':')[1]?.trim();
      } else if (line.includes('Type:')) {
        server.type = line.split(':')[1]?.trim();
      } else if (line.includes('Command:')) {
        server.command = line.split(':')[1]?.trim();
      } else if (line.includes('URL:')) {
        server.url = line.split(':')[1]?.trim();
      }
    }

    return server;
  } catch (error) {
    return { raw_output: output, parse_error: error.message };
  }
}
