/**
 * CodeMirror 扩展配置工厂
 *
 * 提供 CodeMirror 编辑器的语言扩展、diff 视图、minimap、
 * 工具栏面板等扩展的创建函数。
 *
 * @module features/editor/utils/CodeMirrorSetup
 */

import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { showMinimap } from '@replit/codemirror-minimap';
import { EditorView, showPanel, ViewPlugin } from '@codemirror/view';
import { getChunks } from '@codemirror/merge';
import type { Extension } from '@codemirror/state';

// ─── 工具栏面板配置接口 ────────────────────────────────

interface ToolbarPanelOptions {
    diffInfo: { old_string?: string; new_string?: string } | undefined;
    showDiff: boolean;
    isDarkMode: boolean;
    isSidebar: boolean;
    isExpanded: boolean;
    onToggleExpand: (() => void) | null;
    onToggleDiff: () => void;
}

// ─── 语言扩展 ───────────────────────────────────────

/**
 * 根据文件名获取 CodeMirror 语言扩展
 * @param {string} filename - 文件名（含扩展名）
 * @returns {Extension[]} 语言扩展数组
 */
export function getLanguageExtension(filename: string): Extension[] {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
            return [javascript({ jsx: true, typescript: ext.includes('ts') })];
        case 'py':
            return [python()];
        case 'html':
        case 'htm':
            return [html()];
        case 'css':
        case 'scss':
        case 'less':
            return [css()];
        case 'json':
            return [json()];
        case 'md':
        case 'markdown':
            return [markdown()];
        default:
            return [];
    }
}

// ─── Minimap 扩展 ────────────────────────────────────

/**
 * 创建 minimap 扩展（带 diff chunk gutter 标记）
 * @param {Object} options
 * @param {Object|undefined} options.diffInfo - diff 信息
 * @param {boolean} options.showDiff - 是否显示 diff
 * @param {boolean} options.minimapEnabled - 是否启用 minimap
 * @param {boolean} options.isDarkMode - 是否深色模式
 * @returns {Extension[]}
 */
export function createMinimapExtension(options: {
    diffInfo: { old_string?: string; new_string?: string } | undefined;
    showDiff: boolean;
    minimapEnabled: boolean;
    isDarkMode: boolean;
}): Extension[] {
    const { diffInfo, showDiff, minimapEnabled, isDarkMode } = options;

    if (!diffInfo || !showDiff || !minimapEnabled) return [];

    const gutters: Record<number, string> = {};

    return [
        showMinimap.compute(['doc'], (state) => {
            const chunksData = getChunks(state);
            const chunks = chunksData?.chunks || [];

            Object.keys(gutters).forEach(key => delete gutters[key]);

            chunks.forEach(chunk => {
                const fromLine = state.doc.lineAt(chunk.fromB).number;
                const toLine = state.doc.lineAt(Math.min(chunk.toB, state.doc.length)).number;

                for (let lineNum = fromLine; lineNum <= toLine; lineNum++) {
                    gutters[lineNum] = isDarkMode ? 'rgba(34, 197, 94, 0.8)' : 'rgba(34, 197, 94, 1)';
                }
            });

            return {
                create: () => ({ dom: document.createElement('div') }),
                displayText: 'blocks',
                showOverlay: 'always',
                gutters: [gutters]
            };
        })
    ];
}

// ─── 滚动到第一个 chunk 扩展 ────────────────────────────

/**
 * 创建初始化时自动滚动到第一个 diff chunk 的扩展
 * @param {Object|undefined} diffInfo - diff 信息
 * @param {boolean} showDiff - 是否显示 diff
 * @returns {Extension[]}
 */
export function createScrollToFirstChunkExtension(
    diffInfo: { old_string?: string; new_string?: string } | undefined,
    showDiff: boolean
): Extension[] {
    if (!diffInfo || !showDiff) return [];

    return [
        ViewPlugin.fromClass(class {
            constructor(view: EditorView) {
                setTimeout(() => {
                    const chunksData = getChunks(view.state);
                    const chunks = chunksData?.chunks || [];

                    if (chunks.length > 0) {
                        view.dispatch({
                            effects: EditorView.scrollIntoView(chunks[0].fromB, { y: 'center' })
                        });
                    }
                }, 100);
            }
            update() {}
            destroy() {}
        })
    ];
}

// ─── 工具栏面板扩展 ────────────────────────────────────

/**
 * 创建编辑器顶部工具栏面板扩展
 * @param {ToolbarPanelOptions} options
 * @returns {Extension[]}
 */
export function createEditorToolbarPanel(options: ToolbarPanelOptions): Extension[] {
    const { diffInfo, showDiff, isDarkMode, isSidebar, isExpanded, onToggleExpand, onToggleDiff } = options;

    const createPanel = (view: EditorView) => {
        const dom = document.createElement('div');
        dom.className = 'cm-editor-toolbar-panel';

        let currentIndex = 0;

        const updatePanel = () => {
            const hasDiff = diffInfo && showDiff;
            const chunksData = hasDiff ? getChunks(view.state) : null;
            const chunks = chunksData?.chunks || [];
            const chunkCount = chunks.length;

            let toolbarHTML = '<div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">';
            toolbarHTML += '<div style="display: flex; align-items: center; gap: 8px;">';

            if (hasDiff) {
                toolbarHTML += `
                    <span style="font-weight: 500;">${chunkCount > 0 ? `${currentIndex + 1}/${chunkCount}` : '0'} changes</span>
                    <button class="cm-diff-nav-btn cm-diff-nav-prev" title="Previous change" ${chunkCount === 0 ? 'disabled' : ''}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                    <button class="cm-diff-nav-btn cm-diff-nav-next" title="Next change" ${chunkCount === 0 ? 'disabled' : ''}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                `;
            }
            toolbarHTML += '</div>';

            // Right side - action buttons
            toolbarHTML += '<div style="display: flex; align-items: center; gap: 4px;">';

            if (diffInfo) {
                toolbarHTML += `
                    <button class="cm-toolbar-btn cm-toggle-diff-btn" title="${showDiff ? 'Hide diff highlighting' : 'Show diff highlighting'}">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            ${showDiff ?
                                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />' :
                                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />'
                            }
                        </svg>
                    </button>
                `;
            }

            // Settings button
            toolbarHTML += `
                <button class="cm-toolbar-btn cm-settings-btn" title="Editor Settings">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
            `;

            // Expand button (sidebar mode)
            if (isSidebar && onToggleExpand) {
                toolbarHTML += `
                    <button class="cm-toolbar-btn cm-expand-btn" title="${isExpanded ? 'Collapse editor' : 'Expand editor to full width'}">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            ${isExpanded ?
                                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />' :
                                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />'
                            }
                        </svg>
                    </button>
                `;
            }

            toolbarHTML += '</div></div>';
            dom.innerHTML = toolbarHTML;

            // Diff navigation
            if (hasDiff) {
                const prevBtn = dom.querySelector('.cm-diff-nav-prev');
                const nextBtn = dom.querySelector('.cm-diff-nav-next');

                prevBtn?.addEventListener('click', () => {
                    if (chunks.length === 0) return;
                    currentIndex = currentIndex > 0 ? currentIndex - 1 : chunks.length - 1;
                    const chunk = chunks[currentIndex];
                    if (chunk) {
                        view.dispatch({ effects: EditorView.scrollIntoView(chunk.fromB, { y: 'center' }) });
                    }
                    updatePanel();
                });

                nextBtn?.addEventListener('click', () => {
                    if (chunks.length === 0) return;
                    currentIndex = currentIndex < chunks.length - 1 ? currentIndex + 1 : 0;
                    const chunk = chunks[currentIndex];
                    if (chunk) {
                        view.dispatch({ effects: EditorView.scrollIntoView(chunk.fromB, { y: 'center' }) });
                    }
                    updatePanel();
                });
            }

            // Toggle diff button
            if (diffInfo) {
                dom.querySelector('.cm-toggle-diff-btn')?.addEventListener('click', () => {
                    onToggleDiff();
                });
            }

            // Settings button
            dom.querySelector('.cm-settings-btn')?.addEventListener('click', () => {
                if (window.openSettings) {
                    window.openSettings('appearance');
                }
            });

            // Expand button
            if (isSidebar && onToggleExpand) {
                dom.querySelector('.cm-expand-btn')?.addEventListener('click', () => {
                    onToggleExpand();
                });
            }
        };

        updatePanel();

        return {
            top: true,
            dom,
            update: updatePanel
        };
    };

    return [showPanel.of(createPanel)];
}

// ─── Window 接口扩展 ─────────────────────────────────

declare global {
    interface Window {
        openSettings?: (tab: string) => void;
    }
}
