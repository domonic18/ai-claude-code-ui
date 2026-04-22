/**
 * ANSI Color Processor
 *
 * ANSI 颜色处理器
 *
 * 该模块提供终端 ANSI 转义码的解析和处理功能：
 * 1. 解析 ANSI 颜色和样式代码（将转义码转换为结构化样式对象）
 * 2. 移除 ANSI 转义码（提取纯文本内容）
 *
 * ANSI 转义码是终端控制字符，用于控制颜色、光标位置、样式等
 * 常见格式：\x1b[30m 表示设置前景色为黑色
 */

/**
 * 带样式信息的 ANSI 解析段
 * 每个 ANSI 段包含文本内容和相关的样式属性（颜色、背景、粗体等）
 */
export type AnsiSegment = {
  text: string;
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

/** ANSI 前景色映射表（30-37） */
// 将 ANSI 转义码映射为 CSS 颜色名称
const COLOR_MAP: Record<number, string> = {
  30: 'black',
  31: 'red',
  32: 'green',
  33: 'yellow',
  34: 'blue',
  35: 'magenta',
  36: 'cyan',
  37: 'white',
};

/** ANSI 背景色映射表（40-47） */
// 将 ANSI 背景转义码映射为 CSS 颜色名称
const BG_COLOR_MAP: Record<number, string> = {
  40: 'black',
  41: 'red',
  42: 'green',
  43: 'yellow',
  44: 'blue',
  45: 'magenta',
  46: 'cyan',
  47: 'white',
};

/**
 * 解析 ANSI 颜色代码为带样式的文本段
 *
 * 该函数扫描包含 ANSI 转义码的文本，将其分割为多个样式段：
 * 1. 使用正则表达式匹配所有 ANSI 转义码（格式：\x1b[...m）
 * 2. 追踪当前激活的样式状态
 * 3. 为每个非转义码文本段创建一个 AnsiSegment 对象
 * 4. 支持颜色、背景色、粗体、斜体、下划线等样式
 *
 * @param text - 包含 ANSI 转义码的文本
 * @returns 带样式的文本段数组
 */
export function parseAnsiColors(text: string): AnsiSegment[] {
  // ANSI 转义码正则表达式：匹配 \x1b[ 后跟数字和分号，以 m 结尾
  const ansiRegex = /\x1b\[[0-9;]*m/g;

  const segments: AnsiSegment[] = [];

  // lastIndex 标记当前解析位置
  let lastIndex = 0;

  // 当前激活的样式状态
  // 随着转义码解析更新，应用到后续文本段
  let currentStyle: {
    color?: string;
    backgroundColor?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  } = {};

  // 逐个匹配 ANSI 转义码
  let match;
  while ((match = ansiRegex.exec(text)) !== null) {
    // 如果转义码之间有文本，创建一个样式段
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        ...currentStyle,
      });
    }

    // 提取转义码中的数字序列（例如 "31;42;1"）
    const codeStr = match[0].slice(2, -1);
    const codes = codeStr.split(';').map(Number);

    // 处理每个 ANSI 代码
    for (const code of codes) {
      if (code === 0) {
        // 重置所有样式
        currentStyle = {};
      } else if (code === 1) {
        // 设置粗体
        currentStyle.bold = true;
      } else if (code === 3) {
        // 设置斜体
        currentStyle.italic = true;
      } else if (code === 4) {
        // 设置下划线
        currentStyle.underline = true;
      } else if (code in COLOR_MAP) {
        // 设置前景色
        currentStyle.color = COLOR_MAP[code];
      } else if (code in BG_COLOR_MAP) {
        // 设置背景色
        currentStyle.backgroundColor = BG_COLOR_MAP[code];
      }
    }

    // 更新 lastIndex 为当前转义码结束位置
    lastIndex = ansiRegex.lastIndex;
  }

  // 添加最后一段文本（如果有）
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      ...currentStyle,
    });
  }

  return segments;
}

/**
 * 移除文本中的 ANSI 转义码
 *
 * 该函数用于从终端输出中提取纯文本内容：
 * - 删除所有 ANSI 转义序列
 * - 保留可读文本内容
 * - 用于日志记录、文本搜索等场景
 *
 * @param text - 包含 ANSI 转义码的文本
 * @returns 移除所有 ANSI 转义码后的纯文本
 */
export function stripAnsiCodes(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}
