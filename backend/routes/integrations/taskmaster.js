/**
 * TaskMaster API 路由（向后兼容门面）
 *
 * 此文件已重构为模块化路由，实际实现位于 ./taskmaster/ 目录：
 * - taskmaster/index.js — 路由聚合器
 * - taskmaster/detection-routes.js — 安装检测、配置检测
 * - taskmaster/task-routes.js — 任务查询
 * - taskmaster/prd-routes.js — PRD 文件管理
 * - taskmaster/cli-routes.js — CLI 操作（初始化、任务增删改、PRD 解析）
 * - taskmaster/helpers.js — 共享辅助函数
 *
 * 路由层仅负责：参数校验、调用 service、格式化响应。
 * 所有业务逻辑委托给 services/projects/taskmaster/ 模块。
 *
 * @module routes/integrations/taskmaster
 * @deprecated 请直接使用 ./taskmaster/index.js
 */

export { default } from './taskmaster/index.js';
