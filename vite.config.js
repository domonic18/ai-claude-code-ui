import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')


  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './frontend'),
        '@/features': path.resolve(__dirname, './frontend/features'),
        '@/shared-frontend': path.resolve(__dirname, './frontend/shared'),
        '@/shared': path.resolve(__dirname, './shared'),
        '@/config': path.resolve(__dirname, './frontend/config'),
        '@/lib': path.resolve(__dirname, './frontend/lib'),
      },
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
    server: {
      port: parseInt(env.VITE_PORT) || 5173,
      allowedHosts: env.VITE_ALLOWED_HOSTS ? env.VITE_ALLOWED_HOSTS.split(',').map(h => h.trim()).filter(Boolean) : [],
      proxy: {
        '/api': {
          target: `http://localhost:${env.PORT || 3001}`,
          changeOrigin: true,
          secure: false,
          ws: false,
        },
        '/ws': {
          target: `ws://localhost:${env.PORT || 3001}`,
          ws: true,
          changeOrigin: true,
        },
        '/shell': {
          target: `ws://localhost:${env.PORT || 3001}`,
          ws: true,
          changeOrigin: true,
        }
      }
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 500,
      cssMinify: false,
      sourcemap: true, // 启用 source map，方便调试
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true, // 生产构建移除所有 console.* 调用
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-codemirror': [
              '@uiw/react-codemirror',
              '@codemirror/lang-css',
              '@codemirror/lang-html',
              '@codemirror/lang-javascript',
              '@codemirror/lang-json',
              '@codemirror/lang-markdown',
              '@codemirror/lang-python',
              '@codemirror/theme-one-dark'
            ],
            'vendor-xterm': ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-clipboard', '@xterm/addon-webgl'],
            'vendor-markdown': ['react-markdown', 'rehype-katex', 'remark-gfm', 'remark-math', 'katex']
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      }
    }
  }
})