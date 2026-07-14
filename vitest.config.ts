import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// テスト実行環境の定義。ログイン画面はコンポーネント/フック/コンテキストを含むため、
// DOM を伴うテストが必要になる。よって jsdom 環境を採用し、@/ エイリアスを本番の
// tsconfig（paths）と一致させて、テストが本番と同じ import 解決で動くようにする。
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Next.js の App Router 由来ファイル（(auth) など括弧付きディレクトリ）も対象にする
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      // 実装コード（実際のブラウザ/Firebase/Next 依存が強く単体で計測困難な入口）は除外。
      // 設計書 9.2 の方針に従い、SDK 依存部分はモックで検証しカバレッジ算入外とする。
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/types/**',
        'src/app/layout.tsx',
        'src/app/page.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
