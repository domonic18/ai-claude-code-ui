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
import {
    type ToolbarPanelOptions,
    buildDiffNavHTML,
    buildActionsHTML,
    bindToolbarEvents,
} from './editorToolbarAssets.js';

// ─── 语言扩展 ───────────────────────────────────────

const JS_TS_EXTS = new Set(['js', 'jsx', 'ts', 'tsx']);
const HTML_EXTS = new Set(['html', 'htm']);
const CSS_EXTS = new Set(['css', 'scss', 'less']);
const MD_EXTS = new Set(['md', 'markdown']);

/**
 * 根据文件名获取 CodeMirror 语言扩展
 * @param {string} filename - 文件名（含扩展名）
 * @returns {Extension[]} 语言扩展数组
 */
export function getLanguageExtension(filename: string): Extension[] {
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    if (JS_TS_EXTS.has(ext)) return [javascript({ jsx: true, typescript: ext.includes('ts') })];
    if (ext === 'py') return [python()];
    if (HTML_EXTS.has(ext)) return [html()];
    if (CSS_EXTS.has(ext)) return [css()];
    if (ext === 'json') return [json()];
    if (MD_EXTS.has(ext)) return [markdown()];

    return [];
}

// ─── Minimap 扩展 ────────────────────────────────────

/**
 * 创建 minimap 扩展（带 diff chunk gutter 标记）
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
 */
export function createEditorToolbarPanel(options: ToolbarPanelOptions): Extension[] {
    const { diffInfo, showDiff } = options;

    const createPanel = (view: EditorView) => {
        const dom = document.createElement('div');
        dom.className = 'cm-editor-toolbar-panel';
        const currentIndexRef = { value: 0 };

        const updatePanel = () => {
            const hasDiff = diffInfo && showDiff;
            const chunksData = hasDiff ? getChunks(view.state) : null;
            const chunks = chunksData?.chunks || [];
            const chunkCount = chunks.length;

            dom.innerHTML = `<div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                ${buildDiffNavHTML(hasDiff, currentIndexRef.value, chunkCount)}
                ${buildActionsHTML(options)}
            </div>`;

            bindToolbarEvents(dom, view, chunks, currentIndexRef, updatePanel, options);
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
