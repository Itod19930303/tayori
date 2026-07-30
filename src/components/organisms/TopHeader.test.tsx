import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import type { User } from 'firebase/auth'
import { TopHeader } from './TopHeader'

// 共通ヘッダー（organisms 層・propsのみで完結・データ取得なし）の表示検証（テスト仕様書 §5.44）。
// currentUser の有無・displayName/photoURL の欠損バリエーションと、ログアウトボタン押下時の
// onLogoutClick 発火を検証する。TopHeader は signOutUser を呼ばない純粋表示コンポーネントのため
// firebase/auth のモックには依存しない。

// mockUser の共通スタブ。欠損バリエーションは overrides で表現する。
function makeUser(overrides: Partial<User>): User {
  return {
    uid: 'test-uid',
    displayName: 'テスト太郎',
    email: 'test@example.com',
    photoURL: 'https://example.com/a.png',
    ...overrides,
  } as unknown as User
}

describe('TopHeader (共通ヘッダー)', () => {
  it('THD-01: currentUser 指定でアバター画像・ユーザー名・ログアウトボタンを表示する', () => {
    render(
      <TopHeader
        currentUser={makeUser({})}
        onHomeClick={vi.fn()}
        onLogoutClick={vi.fn()}
      />
    )
    const avatar = screen.getByRole('img', { name: /テスト太郎/ })
    expect(avatar).toHaveAttribute('src', 'https://example.com/a.png')
    expect(screen.getByText('テスト太郎')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /ログアウト/ })
    ).toBeInTheDocument()
  })

  it('THD-02: ログアウトボタン押下で onLogoutClick が1回呼ばれる', async () => {
    const onLogoutClick = vi.fn()
    render(
      <TopHeader
        currentUser={makeUser({})}
        onHomeClick={vi.fn()}
        onLogoutClick={onLogoutClick}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    expect(onLogoutClick).toHaveBeenCalledTimes(1)
  })

  it('THD-03: ロゴ/アプリ名「たより」を表示する', () => {
    render(
      <TopHeader
        currentUser={makeUser({})}
        onHomeClick={vi.fn()}
        onLogoutClick={vi.fn()}
      />
    )
    expect(screen.getByText('たより')).toBeInTheDocument()
  })

  it('THD-04: currentUser=null はロゴのみ表示し操作要素を出さず例外も出さない', () => {
    expect(() =>
      render(
        <TopHeader
          currentUser={null}
          onHomeClick={vi.fn()}
          onLogoutClick={vi.fn()}
        />
      )
    ).not.toThrow()
    expect(screen.getByText('たより')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ログアウト/ })).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByText('テスト太郎')).toBeNull()
  })

  it('THD-05: displayName 未設定時は email、両方無ければ「ゲスト」を表示する', () => {
    const { unmount } = render(
      <TopHeader
        currentUser={makeUser({ displayName: null })}
        onHomeClick={vi.fn()}
        onLogoutClick={vi.fn()}
      />
    )
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    unmount()

    render(
      <TopHeader
        currentUser={makeUser({ displayName: null, email: null })}
        onHomeClick={vi.fn()}
        onLogoutClick={vi.fn()}
      />
    )
    expect(screen.getByText('ゲスト')).toBeInTheDocument()
  })

  it('THD-06: photoURL 未設定時は頭文字を表示し壊れた <img> を出さない', () => {
    render(
      <TopHeader
        currentUser={makeUser({ photoURL: null })}
        onHomeClick={vi.fn()}
        onLogoutClick={vi.fn()}
      />
    )
    // 画像アバターは描画されず、代替として頭文字（「テ」）が表示される
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('テ')).toBeInTheDocument()
  })

  it('THD-07: 権限propを受け取らず全ロールで同一表示（純粋表示コンポーネント）', () => {
    // 権限（role/canManage 等）に関わらず同一要素が描画される（権限判定を持たない）
    render(
      <TopHeader
        currentUser={makeUser({})}
        onHomeClick={vi.fn()}
        onLogoutClick={vi.fn()}
      />
    )
    expect(
      screen.getByRole('button', { name: /ログアウト/ })
    ).toBeInTheDocument()
    expect(screen.getByText('テスト太郎')).toBeInTheDocument()
  })

  it('THD-08: organisms 層のデータ非アクセス制約を維持（Firebase SDK を含まない）', () => {
    // 実装ソースに Firebase SDK の呼び出し・データ層 import を含まないことを確認する。
    // （説明コメント中の語を誤検出しないよう、呼び出し `(` や import 文の形で判定する）
    const source = readFileSync(
      'src/components/organisms/TopHeader.tsx',
      'utf-8'
    )
    // signOut()/onSnapshot()/uploadBytesResumable() の実呼び出しを含まない
    expect(source).not.toMatch(/\bsignOut\s*\(|\bonSnapshot\s*\(|\buploadBytesResumable\s*\(/)
    // auth ラッパー・Firestore/Storage SDK からの import を含まない（firebase/auth の type import のみ許容）
    expect(source).not.toMatch(/from\s+['"]@\/lib\/auth['"]/)
    expect(source).not.toMatch(/from\s+['"]firebase\/(firestore|storage)['"]/)
  })

  it('THD-09: ホームボタンが currentUser 指定時に表示され押下で onHomeClick が1回呼ばれる', async () => {
    const onHomeClick = vi.fn()
    render(
      <TopHeader
        currentUser={makeUser({})}
        onHomeClick={onHomeClick}
        onLogoutClick={vi.fn()}
      />
    )
    const homeButton = screen.getByRole('button', { name: 'ホームへ戻る' })
    expect(homeButton).toBeInTheDocument()
    await userEvent.click(homeButton)
    expect(onHomeClick).toHaveBeenCalledTimes(1)
  })

  it('THD-10: ホームボタンは currentUser=null でも常に表示され押下で onHomeClick が呼ばれる', async () => {
    const onHomeClick = vi.fn()
    render(
      <TopHeader
        currentUser={null}
        onHomeClick={onHomeClick}
        onLogoutClick={vi.fn()}
      />
    )
    // ログアウトボタン群（currentUser && ...）は非表示だがホームボタンは表示される
    expect(screen.getByText('たより')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ログアウト/ })).toBeNull()
    const homeButton = screen.getByRole('button', { name: 'ホームへ戻る' })
    await userEvent.click(homeButton)
    expect(onHomeClick).toHaveBeenCalledTimes(1)
  })

  it('THD-11: ホームボタンは独立した button でアクセシビリティ属性を持ち、ロゴはリンク化しない', () => {
    render(
      <TopHeader
        currentUser={makeUser({})}
        onHomeClick={vi.fn()}
        onLogoutClick={vi.fn()}
      />
    )
    const homeButton = screen.getByRole('button', { name: 'ホームへ戻る' })
    expect(homeButton).toHaveAttribute('type', 'button')
    expect(homeButton).toHaveAttribute('aria-label', 'ホームへ戻る')
    // ロゴ「たより」自体は <a>/リンクになっていない（独立ボタン方針）
    expect(screen.getByText('たより').closest('a')).toBeNull()
  })

  it('THD-12: homeDisabled=true のときホームボタンが aria-disabled で押下しても onHomeClick を呼ばない', async () => {
    const onHomeClick = vi.fn()
    render(
      <TopHeader
        currentUser={makeUser({})}
        onHomeClick={onHomeClick}
        onLogoutClick={vi.fn()}
        homeDisabled
      />
    )
    const homeButton = screen.getByRole('button', { name: 'ホームへ戻る' })
    expect(homeButton).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(homeButton)
    expect(onHomeClick).not.toHaveBeenCalled()
  })
})
