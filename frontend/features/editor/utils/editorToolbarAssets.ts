/**
 * Editor Toolbar SVG Icons & HTML Builders
 *
 * Extracted from CodeMirrorSetup.ts to reduce file complexity.
 * Contains toolbar SVG icons, HTML builders, and event bindings.
 *
 * @module features/editor/utils/editorToolbarAssets
 */

import type { EditorView } from '@codemirror/view';

// ─── SVG Icons ──────────────────────────────────────────

/** Diff 导航向上箭头图标：跳转到上一个差异 */
export const CHEVRON_UP_SVG = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" /></svg>';
/** Diff 导航向下箭头图标：跳转到下一个差异 */
export const CHEVRON_DOWN_SVG = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>';
/** 设置图标：打开编辑器设置面板 */
export const SETTINGS_SVG = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>';

/** 眼睛图标：diff 可见性切换（显示状态） */
const EYE_OPEN_SVG = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>';
/** 眼睛图标：diff 可见性切换（隐藏状态） */
const EYE_CLOSED_SVG = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>';

/** 展开/收起图标：展开状态（向四个角展开） */
const EXPAND_OPEN_SVG = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" /></svg>';
/** 展开/收起图标：收起状态（向中心收缩） */
const EXPAND_CLOSED_SVG = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>';

// ─── Icon Selectors ─────────────────────────────────────

/**
 * 根据显示状态返回对应的眼眼图标 SVG
 * @param show - 是否显示 diff
 * @returns SVG 字符串
 */
export function getEyeSVG(show: boolean): string {
    return show ? EYE_OPEN_SVG : EYE_CLOSED_SVG;
}

/**
 * 根据展开状态返回对应的展开/收起图标 SVG
 * @param expanded - 是否展开
 * @returns SVG 字符串
 */
export function getExpandSVG(expanded: boolean): string {
    return expanded ? EXPAND_OPEN_SVG : EXPAND_CLOSED_SVG;
}

// ─── HTML Builders ──────────────────────────────────────
// 工具栏面板选项：diff 信息、显示状态、主题、侧边栏模式等
export interface ToolbarPanelOptions {
    diffInfo: { old_string?: string; new_string?: string } | undefined;
    showDiff: boolean;
    isDarkMode: boolean;
    isSidebar: boolean;
    isExpanded: boolean;
    onToggleExpand: (() => void) | null;
    onToggleDiff: () => void;
}

/**
 * Build diff navigation section HTML
 */
export function buildDiffNavHTML(hasDiff: boolean, currentIndex: number, chunkCount: number): string {
    if (!hasDiff) return '<div style="display: flex; align-items: center; gap: 8px;"></div>';
    return `<div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 500;">${chunkCount > 0 ? `${currentIndex + 1}/${chunkCount}` : '0'} changes</span>
        <button class="cm-diff-nav-btn cm-diff-nav-prev" title="Previous change" ${chunkCount === 0 ? 'disabled' : ''}>${CHEVRON_UP_SVG}</button>
        <button class="cm-diff-nav-btn cm-diff-nav-next" title="Next change" ${chunkCount === 0 ? 'disabled' : ''}>${CHEVRON_DOWN_SVG}</button>
    </div>`;
}

/**
 * Build action buttons section HTML
 */
export function buildActionsHTML(options: ToolbarPanelOptions): string {
    let html = '<div style="display: flex; align-items: center; gap: 4px;">';

    if (options.diffInfo) {
        html += `<button class="cm-toolbar-btn cm-toggle-diff-btn" title="${options.showDiff ? 'Hide diff highlighting' : 'Show diff highlighting'}">${getEyeSVG(options.showDiff)}</button>`;
    }

    html += `<button class="cm-toolbar-btn cm-settings-btn" title="Editor Settings">${SETTINGS_SVG}</button>`;

    if (options.isSidebar && options.onToggleExpand) {
        html += `<button class="cm-toolbar-btn cm-expand-btn" title="${options.isExpanded ? 'Collapse editor' : 'Expand editor to full width'}">${getExpandSVG(options.isExpanded)}</button>`;
    }

    html += '</div>';
    return html;
}

// ─── Event Binding ──────────────────────────────────────
/**
 * Bind toolbar button click events
 */
export function bindToolbarEvents(
    dom: HTMLDivElement,
    view: EditorView,
    chunks: Array<{ fromB: number }>,
    currentIndexRef: { value: number },
    updatePanel: () => void,
    options: ToolbarPanelOptions
): void {
    const { diffInfo, isSidebar, onToggleExpand, onToggleDiff } = options;
    const hasDiff = diffInfo && options.showDiff;

    // 绑定 diff 导航按钮事件：上一个/下一个变更块
    if (hasDiff) {
        dom.querySelector('.cm-diff-nav-prev')?.addEventListener('click', () => {
            if (chunks.length === 0) return;
            currentIndexRef.value = currentIndexRef.value > 0 ? currentIndexRef.value - 1 : chunks.length - 1;
            const chunk = chunks[currentIndexRef.value];
            if (chunk) view.dispatch({ effects: EditorView.scrollIntoView(chunk.fromB, { y: 'center' }) });
            updatePanel();
        });

        dom.querySelector('.cm-diff-nav-next')?.addEventListener('click', () => {
            if (chunks.length === 0) return;
            currentIndexRef.value = currentIndexRef.value < chunks.length - 1 ? currentIndexRef.value + 1 : 0;
            const chunk = chunks[currentIndexRef.value];
            if (chunk) view.dispatch({ effects: EditorView.scrollIntoView(chunk.fromB, { y: 'center' }) });
            updatePanel();
        });
    }

    // 绑定 diff 切换按钮事件
    if (diffInfo) {
        dom.querySelector('.cm-toggle-diff-btn')?.addEventListener('click', () => onToggleDiff());
    }

    // 绑定设置按钮事件：打开设置面板
    dom.querySelector('.cm-settings-btn')?.addEventListener('click', () => {
        if (window.openSettings) window.openSettings('appearance');
    });

    // 绑定展开按钮事件：仅在侧边栏模式下显示
    if (isSidebar && onToggleExpand) {
        dom.querySelector('.cm-expand-btn')?.addEventListener('click', () => onToggleExpand());
    }
}

// ─── Window Interface Extension ─────────────────────────
// 扩展 Window 接口，添加 openSettings 方法
declare global {
    interface Window {
        openSettings?: (tab: string) => void;
    }
}
