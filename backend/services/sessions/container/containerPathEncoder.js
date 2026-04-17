/**
 * 容器路径编码模块
 *
 * 提供项目名称与容器内存储路径之间的编解码功能。
 * SDK 在容器内基于工作区路径进行编码：
 * - /workspace/my-workspace → -workspace-my-workspace
 * - /workspace/测试 → -workspace---（中文等非ASCII字符转换为-）
 *
 * @module sessions/container/containerPathEncoder
 */

/**
 * 编码项目名称为容器内存储格式
 *
 * 编码规则：
 * 1. 路径开头的 / 替换为 -
 * 2. 路径中间的 / 替换为 -
 * 3. 非ASCII字符（包括中文）替换为 -
 *
 * @param {string} projectName - 项目名称 (如: my-workspace 或 测试)
 * @returns {string} 编码后的名称 (如: -workspace-my-workspace)
 */
export function encodeProjectName(projectName) {
  // SDK 在容器内编码的是 /workspace/{projectName}
  // 编码规则：/ → -, 非ASCII字符 → -
  const fullPath = `/workspace/${projectName}`;

  // 先将非 ASCII 字符替换为 -
  const asciiOnlyPath = fullPath.replace(/[^\x00-\x7F]/g, '-');

  // 然后将所有 / 替换为 -
  return asciiOnlyPath.replace(/\//g, '-');
}
