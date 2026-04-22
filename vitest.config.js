import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Vitest 测试配置
 *
 * 与 vite.config.js 共享路径别名，确保测试环境能正确解析 @/ 导入。
 * 使用 jsdom 模拟浏览器环境，支持 localStorage、fetch 等 Web API。
 */
export default defineConfig({
  test: {
    // 使用 jsdom 模拟浏览器环境
    environment: 'jsdom',

    // 全局设置：引入 @testing-library/jest-dom 的自定义 matchers
    setupFiles: ['./frontend/test/setup.js'],

    // 测试文件匹配模式
    include: [
      'frontend/**/*.{test,test-d}.{ts,tsx,js,jsx}',
    ],

    // useProjects 测试依赖的 shared/services 模块树过深，导致 fork 进程 OOM
    exclude: [
      'frontend/features/sidebar/hooks/__tests__/useProjects.test.ts',
    ],

    // Worker 进程内存限制：4GB 可满足当前所有非排除测试
    pool: 'forks',
    poolOptions: {
      forks: {
        execArgv: ['--max-old-space-size=4096'],
      },
    },

    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: [
        'frontend/shared/**/*.{ts,tsx,js,jsx}',
        'frontend/features/**/*.{ts,tsx,js,jsx}',
      ],
      exclude: [
        'frontend/**/*.{test,spec}.{ts,tsx,js,jsx}',
        'frontend/**/types*.{ts,tsx}',
        'frontend/**/__tests__/**',
      ],
    },
  },

  resolve: {
    // 与 vite.config.js 保持一致的路径别名
    alias: {
      '@': path.resolve(__dirname, './frontend'),
      '@/features': path.resolve(__dirname, './frontend/features'),
      '@/shared-frontend': path.resolve(__dirname, './frontend/shared'),
      '@/shared': path.resolve(__dirname, './frontend/shared'),
      '@/config': path.resolve(__dirname, './frontend/config'),
      '@/lib': path.resolve(__dirname, './frontend/lib'),
    },
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
})
