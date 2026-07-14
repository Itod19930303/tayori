import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoginTemplate } from './LoginTemplate'

// LoginTemplate はレイアウト骨格（templates 層）。実データを持たず LoginCard を配置し、
// props を透過的に渡す。背景トークン bg-background を持ち、データ取得を含まないことを検証する。

describe('components/templates/LoginTemplate', () => {
  it('LT-01: LoginCard を描画する（ロゴとボタンが表示される）', () => {
    render(<LoginTemplate onSignIn={vi.fn()} isLoading={false} error={null} />)
    expect(screen.getByText('たより')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Googleでログイン/ })
    ).toBeInTheDocument()
  })

  it('LT-02: props（error）を LoginCard へ透過的に渡す', () => {
    render(
      <LoginTemplate
        onSignIn={vi.fn()}
        isLoading={false}
        error="ネットワーク接続を確認してください。"
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'ネットワーク接続を確認してください。'
    )
  })

  it('LT-03: ルート要素が bg-background を持つ', () => {
    const { container } = render(
      <LoginTemplate onSignIn={vi.fn()} isLoading={false} error={null} />
    )
    const root = container.firstElementChild
    expect(root?.className).toContain('bg-background')
  })
})
