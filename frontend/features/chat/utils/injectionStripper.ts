/**
 * Injection Stripper
 *
 * 剥离用户消息中由后端注入、用 <ccui-inject> 包裹的指令块（目前仅 skill 触发行）。
 *
 * 背景：skill 触发行必须留在用户消息里（与用户原话同处才能指代，如"这个技能"），
 * 故后端用 <ccui-inject type="skill">…</ccui-inject> 包裹后放进 user turn；
 * 显示时由本工具剥掉，保持气泡只显示用户原话。
 *
 * 设计：按固定 token `ccui-inject` 剥离——用户不会手敲该 XML token，故零误删；
 * 且不依赖块内文案，对后端文案漂移免疫。
 */

/** 匹配 <ccui-inject ...>…</ccui-inject> 块及其尾随空白（非贪婪、全局） */
const INJECT_BLOCK = /<ccui-inject\b[^>]*>[\s\S]*?<\/ccui-inject>\s*/g;

/**
 * 剥离用户消息中的 <ccui-inject> 注入块
 * @param text - 原始用户消息文本
 * @returns 剥离并 trim 后的文本
 */
export function stripInjectedWrappers(text: string): string {
  if (!text) return text;
  return text.replace(INJECT_BLOCK, '').trim();
}
