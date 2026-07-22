/**
 * ChatToolbar 按钮共享基础样式
 *
 * 工具栏四个按钮（Skill / 权限模式 / 生成摘要 / 模型）共用同一「骨架」：
 * 固定高度 h-8、统一字号 text-sm、圆角 rounded-lg、间距 gap-1.5 ——
 * 保证视觉上等高对齐。各按钮只追加自己的语义颜色与图标，保留功能区分。
 *
 * 设计要点：用固定高度 h-8（32px）替代靠 padding 撑高，
 * 这样无论字号/图标如何变化，四个按钮永远等高对齐，最抗「视觉错觉」。
 *
 * @module features/chat/components/toolbarButtonStyles
 */

/**
 * 工具栏按钮基础类名（骨架）。
 * 引用方在此之上追加各自的 border/bg/text 颜色与图标，不要再覆盖尺寸类。
 */
export const TOOLBAR_BUTTON_BASE =
  'flex items-center h-8 gap-1.5 px-3 text-sm font-medium rounded-lg border transition-colors';
