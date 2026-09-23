/**
 * 容器路径编码模块
 *
 * 提供项目名称与容器内存储路径之间的编解码功能。
 * SDK 在容器内基于工作区路径进行编码：
 * - /workspace/my-workspace → -workspace-my-workspace
 * - /workspace/测试 → -workspace---（中文等非ASCII字符转换为-）
 * - /workspace/a_b → -workspace-a-b（下划线等特殊字符同样转换为-）
 *
 * 编码规则必须与 SDK 一致：所有非 [a-zA-Z0-9-] 字符（含下划线、点、空格、
 * 非 ASCII 字符）统一替换为 -。此前只替换非 ASCII 字符，导致含下划线的
 * 项目名（如 23df而w--__）读路径（-workspace-23df-w--__）与 SDK 写路径
 * （-workspace-23df-w----）不一致，会话列表永远为空。
 *
 * @module sessions/container/containerPathEncoder
 */

// 在构建容器路径时调用，将主机项目路径编码为 Docker 容器内路径格式
// containerPathEncoder.js 功能函数
/**
 * 编码项目名称为容器内存储格式
 *
 * @param {string} projectName - 项目名称 (如: my-workspace 或 测试)
 * @returns {string} 编码后的名称 (如: -workspace-my-workspace)
 */
export function encodeProjectName(projectName) {
  // SDK 在容器内编码的是 /workspace/{projectName}
  // 编码规则与 SDK 对齐：所有非 [a-zA-Z0-9-] 字符 → -
  const fullPath = `/workspace/${projectName}`;
  return fullPath.replace(/[^a-zA-Z0-9-]/g, '-');
}

