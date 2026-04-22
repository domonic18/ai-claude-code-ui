/**
 * commandValidators.js
 *
 * 命令验证器
 *
 * 提供命令验证功能，从 commandParser.js 提取以降低复杂度
 *
 * @module utils/commandValidators
 */

import { parse as parseShellCommand } from 'shell-quote';
import path from 'path';

/**
 * Bash 命令允许列表
 * @type {string[]}
 */
const BASH_COMMAND_ALLOWLIST = [
  'echo',
  'ls',
  'pwd',
  'date',
  'whoami',
  'git',
  'npm',
  'node',
  'cat',
  'grep',
  'find',
  'task-master'
];

/**
 * 危险字符模式
 * @type {RegExp}
 */
const DANGEROUS_PATTERN = /[;&|`$()<>{}[\]\\]/;

// 工具函数，供多个模块调用
/**
 * 验证命令及其参数是否安全
 * @param {string} commandString - 要验证的命令字符串
 * @returns {{ allowed: boolean, command: string, args: string[], error?: string }} 验证结果
 */
export function validateCommand(commandString) {
  const trimmedCommand = commandString.trim();
  if (!trimmedCommand) {
    return { allowed: false, command: '', args: [], error: '命令为空' };
  }

  // 使用 shell-quote 解析命令以正确处理引号
  const parsed = parseShellCommand(trimmedCommand);

  // 检查 shell 运算符或控制结构
  const hasOperators = parsed.some(token =>
    typeof token === 'object' && token.op
  );

  if (hasOperators) {
    return {
      allowed: false,
      command: '',
      args: [],
      error: '不允许使用 shell 运算符（&&、||、|、; 等）'
    };
  }

  // 提取命令和参数（验证后都应该是字符串）
  const tokens = parsed.filter(token => typeof token === 'string');

  if (tokens.length === 0) {
    return { allowed: false, command: '', args: [], error: '未找到有效命令' };
  }

  const [command, ...args] = tokens;

  // 仅提取命令名称（如果有路径则移除）
  const commandName = path.basename(command);

  // 检查命令是否完全匹配允许列表（无前缀匹配）
  const isAllowed = BASH_COMMAND_ALLOWLIST.includes(commandName);

  if (!isAllowed) {
    return {
      allowed: false,
      command: commandName,
      args,
      error: `命令 '${commandName}' 不在允许列表中`
    };
  }

  // 验证参数不包含危险的元字符
  for (const arg of args) {
    if (DANGEROUS_PATTERN.test(arg)) {
      return {
        allowed: false,
        command: commandName,
        args,
        error: `参数包含危险字符: ${arg}`
      };
    }
  }

  return { allowed: true, command: commandName, args };
}

