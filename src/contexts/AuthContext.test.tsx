import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import type { User } from 'firebase/auth'

// AuthContext は onAuthStateChanged を購読して { currentUser, loading } を提供する。
// テストではコールバックを保持し、任意のタイミングで User / null を発火して状態遷移を検証する。
// 実 Firebase 接続を避けるため firebase/auth と lib/firebase をモックする。

let authCallback: ((user: User | null) => void) | null = null
const unsubscribe = vi.fn()
const onAuthStateChanged = vi.fn((_auth: unknown, cb: (user: User | null) => void) => {
  authCallback = cb
  return unsubscribe
})

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (auth: unknown, cb: (user: User | null) => void) =>
    onAuthStateChanged(auth, cb),
}))
vi.mock('@/lib/firebase', () => ({
  auth: { type: 'auth-stub' },
  db: {},
  storage: {},
}))

import { AuthProvider, AuthContext } from './AuthContext'

const mockUser = {
  uid: 'test-uid',
  displayName: 'テスト太郎',
  email: 'test@example.com',
  photoURL: 'https://example.com/photo.png',
} as unknown as User

// Context の現在値を DOM に描画して検証するための消費コンポーネント
function Probe() {
  return (
    <AuthContext.Consumer>
      {(value) => (
        <div>
          <span data-testid="user">{value?.currentUser?.uid ?? 'null'}</span>
          <span data-testid="loading">{String(value?.loading)}</span>
        </div>
      )}
    </AuthContext.Consumer>
  )
}

describe('contexts/AuthContext', () => {
  beforeEach(() => {
    authCallback = null
    vi.clearAllMocks()
  })

  it('AC-01: 初期値は currentUser=null / loading=true', () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    expect(screen.getByTestId('user')).toHaveTextContent('null')
    expect(screen.getByTestId('loading')).toHaveTextContent('true')
  })

  it('AC-02: User 検知で currentUser 設定・loading=false', () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    act(() => authCallback?.(mockUser))
    expect(screen.getByTestId('user')).toHaveTextContent('test-uid')
    expect(screen.getByTestId('loading')).toHaveTextContent('false')
  })

  it('AC-03: 未ログイン確定時は currentUser=null / loading=false', () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    act(() => authCallback?.(null))
    expect(screen.getByTestId('user')).toHaveTextContent('null')
    expect(screen.getByTestId('loading')).toHaveTextContent('false')
  })

  it('AC-04: セッション切れ（User→null）を検知して更新する', () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    act(() => authCallback?.(mockUser))
    expect(screen.getByTestId('user')).toHaveTextContent('test-uid')
    act(() => authCallback?.(null))
    expect(screen.getByTestId('user')).toHaveTextContent('null')
  })

  it('AC-05: アンマウント時に購読解除する', () => {
    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('AC-06: 提供値のキーが currentUser / loading の2つのみ', () => {
    let captured: Record<string, unknown> = {}
    render(
      <AuthProvider>
        <AuthContext.Consumer>
          {(value) => {
            captured = value as unknown as Record<string, unknown>
            return null
          }}
        </AuthContext.Consumer>
      </AuthProvider>
    )
    expect(Object.keys(captured).sort()).toEqual(['currentUser', 'loading'])
  })
})
