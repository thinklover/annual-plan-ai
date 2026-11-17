// 由 vite.config.ts 的 define 在建置時填入
declare const __APP_VERSION__: string
declare const __APP_COMMIT__: string
declare const __APP_BUILD_DATE__: string

export const APP_VERSION = __APP_VERSION__
export const APP_COMMIT = __APP_COMMIT__
export const APP_BUILD_DATE = __APP_BUILD_DATE__

/** 滑鼠移到版本號上時顯示，例：建置日期 2026-11-17・1b0a876 */
export const buildInfo = () => `建置日期 ${[APP_BUILD_DATE, APP_COMMIT].filter(Boolean).join('・')}`
