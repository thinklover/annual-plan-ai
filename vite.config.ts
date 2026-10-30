import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base 用相對路徑，部署到 GitHub Pages 的子路徑（/annual-plan-ai/）也能正常載入
export default defineConfig({
  base: './',
  plugins: [react()],
})
