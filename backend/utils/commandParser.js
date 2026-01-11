import matter from 'gray-matter';
import { promises as fs } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { parse as parseShellCommand } from 'shell-quote';

const execFileAsync = promisify(execFile);

// 配置
const MAX_INCLUDE_DEPTH = 3;
const BASH_TIMEOUT = 30000; // 30 秒
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
 * 解析 markdown 命令文件并提取 frontmatter 和内容
 * @param {string} content - 原始 markdown 内容
 * @returns {object} 解析后的命令，包含 data（frontmatter）和 content
 */
export function parseCommand(content) {
  try {
    const parsed = matter(content);
    return {
      data: parsed.data || {},
      content: parsed.content || '',
      raw: content
    };
  } catch (error) {
    throw new Error(`解析命令失败: ${error.message}`);
  }
}

/**
 * 替换内容中的参数占位符
 * @param {string} content - 包含占位符的内容
 * @param {string|array} args - 要替换的参数（字符串或数组）
 * @returns {string} 替换参数后的内容
 */
export function replaceArguments(content, args) {
  if (!content) return content;

  let result = content;

  // 如果 args 是字符串，则转换为数组
  const argsArray = Array.isArray(args) ? args : (args ? [args] : []);

  // 用所有参数（用空格连接）替换 $ARGUMENTS
  const allArgs = argsArray.join(' ');
  result = result.replace(/\$ARGUMENTS/g, allArgs);

  // 替换位置参数 $1-$9
  for (let i = 1; i <= 9; i++) {
    const regex = new RegExp(`\\$${i}`, 'g');
    const value = argsArray[i - 1] || '';
    result = result.replace(regex, value);
  }

  return result;
}

/**
 * 验证文件路径以防止目录遍历攻击
 * @param {string} filePath - 要验证的路径
 * @param {string} basePath - 基础目录路径
 * @returns {boolean} 如果路径安全则返回 true
 */
export function isPathSafe(filePath, basePath) {
  const resolvedPath = path.resolve(basePath, filePath);
  const resolvedBase = path.resolve(basePath);
  const relative = path.relative(resolvedBase, resolvedPath);
  return (
    relative !== '' &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
  );
}

/**
 * 处理内容中的文件包含（@filename 语法）
 * @param {string} content - 包含 @filename 包含的内容
 * @param {string} basePath - 用于解析文件路径的基础目录
 * @param {number} depth - 当前递归深度
 * @returns {Promise<string>} 解析包含后的内容
 */
export async function processFileIncludes(content, basePath, depth = 0) {
  if (!content) return content;

  // 防止无限递归
  if (depth >= MAX_INCLUDE_DEPTH) {
    throw new Error(`超过最大包含深度 (${MAX_INCLUDE_DEPTH})`);
  }

  // 匹配 @filename 模式（在行首或空格后）
  const includePattern = /(?:^|\s)@([^\s]+)/gm;
  const matches = [...content.matchAll(includePattern)];

  if (matches.length === 0) {
    return content;
  }

  let result = content;

  for (const match of matches) {
    const fullMatch = match[0];
    const filename = match[1];

    // 安全性：防止目录遍历
    if (!isPathSafe(filename, basePath)) {
      throw new Error(`无效的文件路径（检测到目录遍历攻击）: ${filename}`);
    }

    try {
      const filePath = path.resolve(basePath, filename);
      const fileContent = await fs.readFile(filePath, 'utf-8');

      // 递归处理包含文件中的包含
      const processedContent = await processFileIncludes(fileContent, basePath, depth + 1);

      // 用文件内容替换 @filename
      result = result.replace(fullMatch, fullMatch.startsWith(' ') ? ' ' + processedContent : processedContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`文件未找到: ${filename}`);
      }
      throw error;
    }
  }

  return result;
}

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
  const dangerousPattern = /[;&|`$()<>{}[\]\\]/;
  for (const arg of args) {
    if (dangerousPattern.test(arg)) {
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

/**
 * 向后兼容：检查命令是否允许（已弃用）
 * @deprecated 请改用 validateCommand() 以获得更好的安全性
 * @param {string} command - 要验证的命令
 * @returns {boolean} 如果命令允许则返回 true
 */
export function isBashCommandAllowed(command) {
  const result = validateCommand(command);
  return result.allowed;
}

/**
 * 清理 bash 命令输出
 * @param {string} output - 原始命令输出
 * @returns {string} 清理后的输出
 */
export function sanitizeOutput(output) {
  if (!output) return '';

  // 移除控制字符（除 \t、\n、\r 外）
  return [...output]
    .filter(ch => {
      const code = ch.charCodeAt(0);
      return code === 9  // \t
          || code === 10 // \n
          || code === 13 // \r
          || (code >= 32 && code !== 127);
    })
    .join('');
}

/**
 * 处理内容中的 bash 命令（!command 语法）
 * @param {string} content - 包含 !command 语法的内容
 * @param {object} options - bash 执行选项
 * @returns {Promise<string>} bash 命令执行并替换后的内容
 */
export async function processBashCommands(content, options = {}) {
  if (!content) return content;

  const { cwd = process.cwd(), timeout = BASH_TIMEOUT } = options;

  // 匹配 !command 模式（在行首或空格后）
  const commandPattern = /(?:^|\n)!(.+?)(?=\n|$)/g;
  const matches = [...content.matchAll(commandPattern)];

  if (matches.length === 0) {
    return content;
  }

  let result = content;

  for (const match of matches) {
    const fullMatch = match[0];
    const commandString = match[1].trim();

    // 安全性：验证命令并解析参数
    const validation = validateCommand(commandString);

    if (!validation.allowed) {
      throw new Error(`命令不允许: ${commandString} - ${validation.error}`);
    }

    try {
      // 使用 execFile 与解析的参数一起执行，不使用 shell
      const { stdout, stderr } = await execFileAsync(
        validation.command,
        validation.args,
        {
          cwd,
          timeout,
          maxBuffer: 1024 * 1024, // 最大输出 1MB
          shell: false, // 重要：无 shell 解释
          env: { ...process.env, PATH: process.env.PATH } // 继承 PATH 以查找命令
        }
      );

      const output = sanitizeOutput(stdout || stderr || '');

      // 用输出替换 !command
      result = result.replace(fullMatch, fullMatch.startsWith('\n') ? '\n' + output : output);
    } catch (error) {
      if (error.killed) {
        throw new Error(`命令超时: ${commandString}`);
      }
      throw new Error(`命令失败: ${commandString} - ${error.message}`);
    }
  }

  return result;
}
