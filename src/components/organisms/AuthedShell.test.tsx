import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import type { User } from 'firebase/auth'
import { AuthedShell } from './AuthedShell'

// ログイン済み共通シェル（organisms 層・propsのみで完結・データ取得なし）の表示検証。
// アルバム詳細/メディアプレビュー/権限管理の3ページで完全一致していたローカル AuthedShell を
// 共通コンポーネント化したもの。TopHeader（ヘッダー）＋ログアウトエラー帯＋children を描画し、
// エラー画面でもログアウト導線を維持する（CodeRabbit Major指摘）。純粋表示のため Firebase SDK に依存しない。

// mockUser の共通スタブ。TopHeader へそのまま委譲するため最小限のフィールドのみ持たせる。
function makeUser(overrides: Partial<User> = {}): User {
  return {
    uid: 'test-uid',
    displayName: 'テスト太郎',
    email: 'test@example.com',
    photoURL: 'https://example.com/a.png',
    ...overrides,
  } as unknown as User
}

describe('AuthedShell (ログイン済み共通シェル)', () => {
  it('AS-01: TopHeader（ユーザー名・ログアウトボタン）と children を描画する', () => {
    render(
      <AuthedShell
        currentUser={makeUser()}
        onLogoutClick={vi.fn()}
        logoutError={null}
      >
        <div data-testid="child">本文</div>
      </AuthedShell>
    )
    expect(screen.getByText('テスト太郎')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /ログアウト/ })
    ).toBeInTheDocument()
    expect(screen.getByTestId('child')).toHaveTextContent('本文')
  })

  it('AS-02: ログアウトボタン押下で onLogoutClick が1回呼ばれる', async () => {
    const onLogoutClick = vi.fn()
    render(
      <AuthedShell
        currentUser={makeUser()}
        onLogoutClick={onLogoutClick}
        logoutError={null}
      >
        <div />
      </AuthedShell>
    )
    await userEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    expect(onLogoutClick).toHaveBeenCalledTimes(1)
  })

  it('AS-03: logoutError=null のときエラー帯（role=alert）を描画しない', () => {
    render(
      <AuthedShell
        currentUser={makeUser()}
        onLogoutClick={vi.fn()}
        logoutError={null}
      >
        <div />
      </AuthedShell>
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('AS-04: logoutError 指定時は role=alert / aria-live=assertive の帯にメッセージを表示する', () => {
    render(
      <AuthedShell
        currentUser={makeUser()}
        onLogoutClick={vi.fn()}
        logoutError="ログアウトに失敗しました"
      >
        <div />
      </AuthedShell>
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('ログアウトに失敗しました')
    expect(alert).toHaveAttribute('aria-live', 'assertive')
  })

  it('AS-05: organisms 層のデータ非アクセス制約を維持（Firebase SDK を含まない）', () => {
    // 実装ソースに Firebase SDK の呼び出し・データ層 import を含まないことを確認する。
    const source = readFileSync(
      'src/components/organisms/AuthedShell.tsx',
      'utf-8'
    )
    expect(source).not.toMatch(
      /\bsignOut\s*\(|\bonSnapshot\s*\(|\buploadBytesResumable\s*\(/
    )
    expect(source).not.toMatch(/from\s+['"]@\/lib\/auth['"]/)
    expect(source).not.toMatch(/from\s+['"]firebase\/(firestore|storage)['"]/)
  })
})
