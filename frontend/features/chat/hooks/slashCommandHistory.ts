/**
 * Slash Command History
 * =====================
 *
 * Command history and frequency tracking for slash commands.
 * Extracted from useSlashCommands.ts to reduce complexity.
 *
 * @module hooks/slashCommandHistory
 */

// 导入日志工具，用于记录错误信息
import { logger } from '@/shared/utils/logger';

/**
 * 安全的 localStorage 封装
 *
 * 捕获 localStorage 操作的异常（如隐私模式、配额超限等）
 * 确保在异常情况下不会导致应用崩溃
 */
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      // localStorage 不可用（如隐私模式），返回 null
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // localStorage 写入失败（如配额超限），记录警告但不中断执行
      logger.warn('Failed to set localStorage item:', e);
    }
  }
};

/**
 * 更新 localStorage 中的命令历史记录
 *
 * 每次执行斜杠命令时，增加该命令的使用计数
 * 用于后续计算常用命令和智能排序
 *
 * @param {string} commandName - 命令名称（如 "/help"）
 * @param {string} projectName - 项目名称，按项目隔离命令历史
 */
export function updateCommandHistory(
  commandName: string,
  projectName: string
): void {
  // 构建项目特定的 localStorage 键名
  const historyKey = `command_history_${projectName}`;
  // 从 localStorage 读取现有历史记录
  const history = safeLocalStorage.getItem(historyKey);
  let parsedHistory: Record<string, number> = {};

  try {
    // 解析 JSON 格式的历史记录
    parsedHistory = history ? JSON.parse(history) : {};
  } catch (e) {
    // 解析失败，初始化为空对象
    logger.error('Error parsing command history:', e);
  }

  // 增加该命令的使用计数
  parsedHistory[commandName] = (parsedHistory[commandName] || 0) + 1;
  // 将更新后的历史记录保存到 localStorage
  safeLocalStorage.setItem(historyKey, JSON.stringify(parsedHistory));
}

/**
 * 根据历史记录更新常用命令列表
 *
 * 从所有命令中筛选出使用过的命令，按使用频率降序排序
 * 返回使用次数最多的前 5 个命令
 *
 * @param {any[]} allCommands - 所有可用命令的列表
 * @param {string} projectName - 项目名称
 * @returns {any[]} 按使用频率排序的常用命令列表（最多 5 个）
 */
export function updateFrequentCommands(
  allCommands: any[],
  projectName: string
): any[] {
  const historyKey = `command_history_${projectName}`;
  const history = safeLocalStorage.getItem(historyKey);

  // 如果没有历史记录，返回空数组
  if (!history) {
    return [];
  }

  try {
    // 解析历史记录 JSON
    const parsedHistory = JSON.parse(history);

    // 为每个命令添加使用计数，并筛选出使用过的命令
    const commandsWithUsage = allCommands
      .map(cmd => ({
        ...cmd,
        // 从历史记录中获取使用次数，默认为 0
        usageCount: parsedHistory[cmd.name] || 0
      }))
      // 只保留使用过至少一次的命令
      .filter(cmd => cmd.usageCount > 0)
      // 按使用次数降序排序
      .sort((a, b) => b.usageCount - a.usageCount)
      // 只取前 5 个最常用的命令
      .slice(0, 5);

    return commandsWithUsage;
  } catch (e) {
    logger.error('Error parsing command history:', e);
    return [];
  }
}

/**
 * 从 localStorage 加载命令历史记录
 *
 * 读取指定项目的命令使用次数映射表
 * 用于初始化命令历史或重新加载数据
 *
 * @param {string} projectName - 项目名称
 * @returns {Record<string, number>} 命令历史映射表，key 为命令名，value 为使用次数
 */
export function loadCommandHistory(projectName: string): Record<string, number> {
  // 构建项目特定的 localStorage 键名
  const historyKey = `command_history_${projectName}`;
  const history = safeLocalStorage.getItem(historyKey);

  // 如果没有历史记录，返回空对象
  if (!history) {
    return {};
  }

  try {
    // 解析并返回历史记录 JSON
    return JSON.parse(history);
  } catch (e) {
    // 解析失败，记录错误并返回空对象
    logger.error('Error parsing command history:', e);
    return {};
  }
}
