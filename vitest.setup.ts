import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// 各テスト後に DOM とモックの状態をリセットし、テスト間の状態漏れを防ぐ。
// AuthContext の onAuthStateChanged コールバック保持など、モックが状態を持つケースが
// あるため、cleanup とモッククリアを両方明示的に行う。
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
