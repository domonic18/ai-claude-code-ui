/**
 * CodeMirror 扩展配置工厂
 *
 * 提供 CodeMirror 编辑器的语言扩展、diff 视图、minimap、
 * 工具栏面板等扩展的创建函数。
 *
 * @module features/editor/utils/CodeMirrorSetup
 */

// CodeMirror 语言支持：JavaScript、Python、HTML、CSS、JSON、Markdown
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
// 文件扩展名集合，用于快速判断语言类型
// 使用 Set 数据结构提高查找性能
const JS_TS_EXTS = new Set(['js', 'jsx', 'ts', 'tsx']);
const HTML_EXTS = new Set(['html', 'htm']);
const CSS_EXTS = new Set(['css', 'scss', 'less']);
const MD_EXTS = new Set(['md', 'markdown']);

/**
 * 根据文件名获取 CodeMirror 语言扩展
 * CodeMirror 使用扩展系统提供语法高亮、自动补全等功能
 * @param {string} filename - 文件名（含扩展名）
 * @returns {Extension[]} 语言扩展数组
 */
export function getLanguageExtension(filename: string): Extension[] {
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    // JavaScript/TypeScript：支持 JSX 和 TSX
    if (JS_TS_EXTS.has(ext)) return [javascript({ jsx: true, typescript: ext.includes('ts') })];
    // Python：无额外配置
    if (ext === 'py') return [python()];
    // HTML：支持模板语法
    if (HTML_EXTS.has(ext)) return [html()];
    // CSS/SCSS/Less：支持嵌套规则
    if (CSS_EXTS.has(ext)) return [css()];
    // JSON：支持验证和格式化
    if (ext === 'json') return [json()];
    // Markdown：支持 GFM（GitHub Flavored Markdown）
    if (MD_EXTS.has(ext)) return [markdown()];

    // 未知语言返回空数组，CodeMirror 将使用纯文本模式
    return [];
}

// ─── Minimap 扩展 ────────────────────────────────────
/**
 * 创建 minimap 扩展（带 diff chunk gutter 标记）
 * Minimap 是编辑器右侧的代码缩略图，帮助用户快速浏览代码
 */
export function createMinimapExtension(options: {
    diffInfo: { old_string?: string; new_string?: string } | undefined;
    showDiff: boolean;
    minimapEnabled: boolean;
    isDarkMode: boolean;
}): Extension[] {
    const { diffInfo, showDiff, minimapEnabled, isDarkMode } = options;

    // 如果没有 diff 信息、不显示 diff 或未启用 minimap，返回空数组
    if (!diffInfo || !showDiff || !minimapEnabled) return [];

    // 记录每行的 gutter 颜色（用于标记 diff chunk）
    // gutter 是 minimap 左侧的标记区域
    const gutters: Record<number, string> = {};

    return [
        showMinimap.compute(['doc'], (state) => {
            const chunksData = getChunks(state);
            const chunks = chunksData?.chunks || [];

            // 清空之前的 gutter 标记
            // 避免文档更新后旧标记残留
            Object.keys(gutters).forEach(key => delete gutters[key]);

            // 为每个 diff chunk 的所有行添加绿色 gutter 标记
            chunks.forEach(chunk => {
                const fromLine = state.doc.lineAt(chunk.fromB).number;
                const toLine = state.doc.lineAt(Math.min(chunk.toB, state.doc.length)).number;

                for (let lineNum = fromLine; lineNum <= toLine; lineNum++) {
                    // 根据主题选择颜色：深色模式使用半透明，浅色模式使用不透明
                    gutters[lineNum] = isDarkMode ? 'rgba(34, 197, 94, 0.8)' : 'rgba(34, 197, 94, 1)';
                }
            });

            return {
                create: () => ({ dom: document.createElement('div') }),
                displayText: 'blocks',  // 使用块状显示
                showOverlay: 'always',  // 始终显示覆盖层
                gutters: [gutters]      // 应用 gutter 颜色标记
            };
        })
    ];
}

// ─── 滚动到第一个 chunk 扩展 ────────────────────────────
/**
 * 创建初始化时自动滚动到第一个 diff chunk 的扩展
 * 提升用户体验：打开 diff 视图时自动定位到第一个变更处
 */
export function createScrollToFirstChunkExtension(
    diffInfo: { old_string?: string; new_string?: string } | undefined,
    showDiff: boolean
): Extension[] {
    if (!diffInfo || !showDiff) return [];

    return [
        ViewPlugin.fromClass(class {
            constructor(view: EditorView) {
                // 延迟 100ms 滚动，确保编辑器已完全渲染
                // CodeMirror 的异步渲染需要时间完成
                setTimeout(() => {
                    const chunksData = getChunks(view.state);
                    const chunks = chunksData?.chunks || [];

                    // 滚动到第一个变更块，方便用户快速定位
                    // 使用 y: 'center' 将变更块放置在视口中央
                    if (chunks.length > 0) {
                        view.dispatch({
                            effects: EditorView.scrollIntoView(chunks[0].fromB, { y: 'center' })
                        });
                    }
                }, 100);
            }
            update() {}  // 视图更新时不执行任何操作
            destroy() {}  // 插件销毁时不执行任何清理操作
        })
    ];
}

// ─── 工具栏面板扩展 ────────────────────────────────────
/**
 * 创建编辑器顶部工具栏面板扩展
 * 工具栏包含：diff 导航、设置按钮、展开按钮等
 */
export function createEditorToolbarPanel(options: ToolbarPanelOptions): Extension[] {
    const { diffInfo, showDiff } = options;

    const createPanel = (view: EditorView) => {
        const dom = document.createElement('div');
        dom.className = 'cm-editor-toolbar-panel';
        // 使用 ref 保存当前 chunk 索引，避免闭包陷阱
        const currentIndexRef = { value: 0 };

        // 更新工具栏面板 HTML：根据 diff 状态和选项生成按钮
        const updatePanel = () => {
            const hasDiff = diffInfo && showDiff;
            const chunksData = hasDiff ? getChunks(view.state) : null;
            const chunks = chunksData?.chunks || [];
            const chunkCount = chunks.length;

            // 动态生成工具栏 HTML：左侧 diff 导航，右侧操作按钮
            dom.innerHTML = `<div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                ${buildDiffNavHTML(hasDiff, currentIndexRef.value, chunkCount)}
                ${buildActionsHTML(options)}
            </div>`;

            // 绑定工具栏按钮点击事件
            // 每次更新 HTML 后需要重新绑定事件监听器
            bindToolbarEvents(dom, view, chunks, currentIndexRef, updatePanel, options);
        };

        // 初始化工具栏
        updatePanel();

        return {
            top: true,      // 显示在编辑器顶部
            dom,           // DOM 元素
            update: updatePanel  // 视图更新时调用此函数
        };
    };

    return [showPanel.of(createPanel)];
}
