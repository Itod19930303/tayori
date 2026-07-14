import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginCard } from './LoginCard'

// LoginCard は molecules（props のみで完結、Firebase 直アクセス禁止）。
// ロゴ/サブテキスト/ボタン/エラー表示の描画とコールバック・無効化・アクセシビリティを検証する。

const SUBTEXT = 'LINEで流れてしまう画像・動画を、チームで一元管理。'

describe('components/molecules/LoginCard', () => {
  it('LC-01: ロゴ「たより」とサブテキストが表示される', () => {
    render(<LoginCard onSignIn={vi.fn()} isLoading={false} error={null} />)
    expect(screen.getByText('たより')).toBeInTheDocument()
    expect(screen.getByText(SUBTEXT)).toBeInTheDocument()
  })

  it('LC-02: ボタン押下で onSignIn が1回呼ばれる', async () => {
    const onSignIn = vi.fn()
    render(<LoginCard onSignIn={onSignIn} isLoading={false} error={null} />)
    await userEvent.click(screen.getByRole('button', { name: /Googleでログイン/ }))
    expect(onSignIn).toHaveBeenCalledTimes(1)
  })

  it('LC-03: isLoading 中はボタンが無効化されクリックしても呼ばれない', async () => {
    const onSignIn = vi.fn()
    render(<LoginCard onSignIn={onSignIn} isLoading={true} error={null} />)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onSignIn).not.toHaveBeenCalled()
  })

  it('LC-04: error があるとき aria-live/role=alert 領域にメッセージ表示', () => {
    const message = 'ネットワーク接続を確認してください。'
    render(<LoginCard onSignIn={vi.fn()} isLoading={false} error={message} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(message)
  })

  it('LC-05: error=null / 空文字 のときエラーメッセージを表示しない', () => {
    const { rerender } = render(
      <LoginCard onSignIn={vi.fn()} isLoading={false} error={null} />
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    rerender(<LoginCard onSignIn={vi.fn()} isLoading={false} error={''} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('LC-06: ボタンは h-12 とデザイントークン（bg-primary 等）を持つ', () => {
    render(<LoginCard onSignIn={vi.fn()} isLoading={false} error={null} />)
    const button = screen.getByRole('button', { name: /Googleでログイン/ })
    expect(button.className).toContain('h-12')
    expect(button.className).toContain('bg-primary')
    expect(button.className).toContain('rounded-lg')
  })
})
