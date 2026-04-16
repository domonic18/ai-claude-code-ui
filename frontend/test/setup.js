/**
 * Vitest 全局 setup 文件
 *
 * 在每个测试文件执行前运行，用于：
 * - 引入 @testing-library/jest-dom 的自定义 matchers（如 toBeInTheDocument）
 * - 配置全局 mock（如 localStorage、fetch）
 */

import '@testing-library/jest-dom/vitest'
