import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 系統版本號：版本取自 package.json，另外標上建置日期（台灣時間）與 git commit
const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')) as { version: string }
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return ''
  }
})()
const buildDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date())

// base 用相對路徑，部署到 GitHub Pages 的子路徑（/annual-plan-ai/）也能正常載入
// 兩個獨立入口：年度業務計畫書（/）與居家評鑑資料系統（/eval/）
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commit),
    __APP_BUILD_DATE__: JSON.stringify(buildDate),
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        eval: resolve(import.meta.dirname, 'eval/index.html'),
      },
    },
  },
})
