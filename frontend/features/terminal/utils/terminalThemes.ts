/**
 * Terminal Theme Colors
 *
 * 终端主题颜色配置模块
 * 定义内置终端主题的颜色方案，支持多种流行配色方案（Monokai、Dracula、Nord 等）
 * 与 xterm.js 的主题结构完全兼容
 */

import type { TerminalTheme } from '../types';

// ThemeColors 的类型别名定义
/**
 * 主题颜色类型定义
 * 匹配 xterm.js 的主题结构，包含背景色、前景色、光标色、16 基础色和亮色
 */
export type ThemeColors = {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
};

/** 内置主题定义 */
// 包含 5 种主流终端配色方案：default（VS Code 默认）、monokai、dracula、nord、solarized
// 每个主题定义了完整的 16 色 ANSI 调色板和 UI 元素颜色
const themes: Record<TerminalTheme, ThemeColors> = {
  default: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#d4d4d4',
    cursorAccent: '#1e1e1e',
    selection: '#264f78',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#ffffff',
  },
  monokai: {
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    cursorAccent: '#272822',
    selection: '#49483e',
    black: '#272822',
    red: '#f92672',
    green: '#a6e22e',
    yellow: '#f4bf75',
    blue: '#66d9ef',
    magenta: '#ae81ff',
    cyan: '#a1efe4',
    white: '#f8f8f2',
    brightBlack: '#75715e',
    brightRed: '#f92672',
    brightGreen: '#a6e22e',
    brightYellow: '#f4bf75',
    brightBlue: '#66d9ef',
    brightMagenta: '#ae81ff',
    brightCyan: '#a1efe4',
    brightWhite: '#f9f8f5',
  },
  dracula: {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    cursorAccent: '#282a36',
    selection: '#44475a',
    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff',
  },
  nord: {
    background: '#2e3440',
    foreground: '#d8dee9',
    cursor: '#d8dee9',
    cursorAccent: '#2e3440',
    selection: '#434c5e',
    black: '#3b4252',
    red: '#bf616a',
    green: '#a3be8c',
    yellow: '#ebcb8b',
    blue: '#81a1c1',
    magenta: '#b48ead',
    cyan: '#88c0d0',
    white: '#e5e9f0',
    brightBlack: '#4c566a',
    brightRed: '#bf616a',
    brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b',
    brightBlue: '#81a1c1',
    brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb',
    brightWhite: '#eceff4',
  },
  solarized: {
    background: '#002b36',
    foreground: '#839496',
    cursor: '#839496',
    cursorAccent: '#002b36',
    selection: '#073642',
    black: '#073642',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5',
    brightBlack: '#586e75',
    brightRed: '#cb4b16',
    brightGreen: '#859900',
    brightYellow: '#b58900',
    brightBlue: '#6c71c4',
    brightMagenta: '#d33682',
    brightCyan: '#2aa198',
    brightWhite: '#fdf6e3',
  },
};

/**
 * 根据主题名称获取终端主题颜色配置
 *
 * 该函数是主题系统的核心入口，用于将主题标识符转换为 xterm.js 可用的颜色对象
 * 如果请求的主题不存在，则返回默认主题作为降级方案
 *
 * @param theme - 主题标识符（TerminalTheme 枚举值）
 * @returns 与 xterm.js 兼容的主题颜色对象，包含所有必需的颜色字段
 */
export function getTerminalThemeColors(theme: TerminalTheme): ThemeColors {
  return themes[theme] || themes.default;
}
