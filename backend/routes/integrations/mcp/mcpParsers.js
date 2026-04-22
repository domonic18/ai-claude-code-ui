/**
 * MCP Output Parsers
 *
 * Parse output from Claude CLI MCP commands.
 *
 * @module routes/integrations/mcp/mcpParsers
 */

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('mcp/parsers');

// 定义 HTTP 路由处理器
/**
 * Extract server name from a list line
 * @param {string} line - A line containing server name and details
 * @returns {{ name: string, rest: string }|null} Parsed name and remainder, or null
 */
function splitNameAndRest(line) {
  if (!line.includes(':')) return null;
  const colonIndex = line.indexOf(':');
  const name = line.substring(0, colonIndex).trim();
  if (!name) return null;
  return { name, rest: line.substring(colonIndex + 1).trim() };
}

// 定义 HTTP 路由处理器
/**
 * Check if text contains status indicators (✓ or ✗)
 * @param {string} text - Text to check
 * @returns {boolean} True if status indicators found
 */
function hasStatusIndicator(text) {
  return text.includes('\u2713') || text.includes('\u2717');
}

// 定义 HTTP 路由处理器
/**
 * Parse status string from match result
 * @param {string} statusText - Matched status text
 * @returns {'connected'|'failed'} Status value
 */
function resolveStatus(statusText) {
  return statusText.includes('\u2713') ? 'connected' : 'failed';
}

// 定义 HTTP 路由处理器
/**
 * Parse status match into description and status
 * @param {string} rest - The part after the colon
 * @returns {{ description: string, status: string }} Extracted fields
 */
function extractDescriptionAndStatus(rest) {
  if (!hasStatusIndicator(rest)) return { description: rest, status: 'unknown' };

  const statusMatch = rest.match(/(.*?)\s*-\s*([\u2713\u2717].*)$/);
  if (!statusMatch) return { description: rest, status: 'unknown' };

  return { description: statusMatch[1].trim(), status: resolveStatus(statusMatch[2]) };
}

// 定义 HTTP 路由处理器
/**
 * Determine server type from its description URL
 * @param {string} description - Server description string
 * @returns {'http'|'stdio'} Server type
 */
function inferServerType(description) {
  if (description.startsWith('http://') || description.startsWith('https://')) return 'http';
  return 'stdio';
}

// 定义 HTTP 路由处理器
/**
 * Parse a single server line from `claude mcp list` output
 * @param {string} line - A line containing server name and details
 * @returns {Object|null} Parsed server info, or null to skip
 */
function parseListLine(line) {
  const split = splitNameAndRest(line);
  if (!split) return null;

  const { description, status } = extractDescriptionAndStatus(split.rest);
  return {
    name: split.name,
    type: inferServerType(description),
    status: status || 'active',
    description
  };
}

// 定义 HTTP 路由处理器
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

/** Mapping of field prefixes to server object keys */
const GET_FIELD_MAP = {
  'Name:': 'name',
  'Type:': 'type',
  'Command:': 'command',
  'URL:': 'url'
};

// 定义 HTTP 路由处理器
/**
 * Try to extract JSON from output
 * @param {string} output - Raw CLI output
 * @returns {Object|null} Parsed JSON object, or null if not found
 */
function tryParseJson(output) {
  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  return JSON.parse(jsonMatch[0]);
}

// 定义 HTTP 路由处理器
/**
 * Extract trimmed value from a colon-separated line
 * @param {string} line - Line to split
 * @returns {string} Trimmed value after first colon
 */
function extractColonValue(line) {
  const parts = line.split(':');
  return parts.length > 1 ? parts[1].trim() : '';
}

// 定义 HTTP 路由处理器
/**
 * Extract a field value from a line if it matches a known prefix
 * @param {string} line - Line to check
 * @returns {{ key: string, value: string }|null} Matched key-value or null
 */
function matchFieldLine(line) {
  for (const [prefix, key] of Object.entries(GET_FIELD_MAP)) {
    if (line.includes(prefix)) {
      return { key, value: extractColonValue(line) };
    }
  }
  return null;
}

// 定义 HTTP 路由处理器
/**
 * Parse text-form server fields from get output
 * @param {string} output - Raw CLI output
 * @returns {Object} Server info with raw_output
 */
function parseTextFields(output) {
  const server = { raw_output: output };
  for (const line of output.split('\n')) {
    const match = matchFieldLine(line);
    if (match) server[match.key] = match.value;
  }
  return server;
}

// 定义 HTTP 路由处理器
/**
 * Parse output from `claude mcp get <name>` command
 * Attempts JSON extraction first, falls back to text parsing
 *
 * @param {string} output - Raw CLI output
 * @returns {object} Parsed server details
 */
export function parseClaudeGetOutput(output) {
  try {
    return tryParseJson(output) || parseTextFields(output);
  } catch (error) {
    return { raw_output: output, parse_error: error.message };
  }
}

