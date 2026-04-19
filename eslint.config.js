import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // 全局忽略
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'docker/',
      'scripts/',
      'extensions/',
      '*.config.js',
      '*.config.mjs',
      '*.config.cjs',
      '*.config.ts',
    ],
  },

  // 基础规则（所有 JS/TS 文件）
  js.configs.recommended,

  // TypeScript 文件配置
  ...tseslint.configs.recommended,

  // 自定义规则
  {
    rules: {
      // ─── 复杂度治理（第四阶段） ──────────────────
      // 函数级圈复杂度 > 20 时警告
      // 新写的函数建议控制在 15 以内
      'complexity': ['warn', { max: 20 }],

      // 函数最大行数 > 80 时警告
      'max-lines-per-function': ['warn', {
        max: 80,
        skipBlankLines: true,
        skipComments: true,
      }],

      // 最大嵌套深度 > 4 时警告
      'max-depth': ['warn', { max: 4 }],

      // ─── TypeScript 宽松处理 ──────────────────
      // 以下规则设为 warn 避免大量报错，后续逐步收紧
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-function': 'off',
    },
  },

  // 后端 JS/TS 文件（ESM）
  {
    files: ['backend/**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        globalThis: 'readonly',
      },
    },
  },

  // 前端 TS/TSX 文件
  {
    files: ['frontend/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        WebSocket: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLInputElement: 'readonly',
        Event: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        IntersectionObserver: 'readonly',
        ResizeObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
  },

  // 共享模块
  {
    files: ['shared/**/*.{ts,tsx,js}'],
  },
);
