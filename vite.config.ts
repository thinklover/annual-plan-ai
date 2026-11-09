import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base 用相對路徑，部署到 GitHub Pages 的子路徑（/annual-plan-ai/）也能正常載入
// 兩個獨立入口：年度業務計畫書（/）與居家評鑑資料系統（/eval/）
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        eval: resolve(import.meta.dirname, 'eval/index.html'),
      },
    },
  },
})
