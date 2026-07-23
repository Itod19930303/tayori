import { defineConfig } from 'vitest/config'

// Firestore Security Rules ユニットテスト専用の Vitest 設定（テスト仕様書 5.41 / 4.13）。
// 通常のコンポーネントテスト（jsdom + firebase SDK モック）とは異なり、
// @firebase/rules-unit-testing は実エミュレータへ接続する node 環境で実行する必要があるため、
// setupFiles（jest-dom）や firebase モックを読み込まない専用設定として分離する。
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['firestore.rules.test.ts'],
    // 各ケースで clearFirestore を待つため、既定より長めのタイムアウトを確保する。
    testTimeout: 20000,
    hookTimeout: 30000,
  },
})
