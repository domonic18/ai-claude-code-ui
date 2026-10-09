/**
 * Command Path Utils
 *
 * 命令行展示优化：长路径中段省略，缓解工具卡横向拥挤。
 *
 * @module chat/utils/commandPath
 */

/** 单段命令超过该长度才截断 */
const TRUNCATE_THRESHOLD = 48;

/**
 * 截断命令中的长路径 token：保留头尾，中段省略
 *
 * `/workspace/.claude/skills/patent-chinese-pct-docx/scripts/pct_us_pipeline.py`
 * → `/workspace/.../pct_us_pipeline.py`
 *
 * 只处理以 / 或 ~ 开头的路径类 token；短路径原样保留。
 *
 * @param command - 原始命令字符串
 * @returns 截断后的命令
 */
export function shortenCommandPaths(command: string): string {
  return command.replace(/[^\s"']+|"[^"]*"|'[^']*'/g, token => {
    // 路径 token：以 / 或 ~ 开头（含引号包裹）
    const unquoted = token.replace(/^["']|["']$/g, '');
    if (!unquoted.startsWith('/') && !unquoted.startsWith('~/')) return token;
    if (unquoted.length <= TRUNCATE_THRESHOLD) return token;
    const lastSlash = unquoted.lastIndexOf('/');
    const tail = lastSlash >= 0 ? unquoted.slice(lastSlash) : '';
    const head = unquoted.slice(0, 12);
    const quote = token !== unquoted ? token[0] : '';
    return `${quote}${head}...${tail}${quote}`;
  });
}
