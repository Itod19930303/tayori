import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AlbumCreateForm } from './AlbumCreateForm'
import { ERROR_MESSAGES } from '@/lib/messages/errorMessages'

// AlbumCreateForm は molecules（props のみで完結）。タイトル/説明入力・文字数カウンター・
// クライアントバリデーション・二重送信防止・サーバーエラー表示を検証する（基本設計書 4.5）。

describe('components/molecules/AlbumCreateForm', () => {
  it('ACF-01: アルバム名・説明の入力欄（ラベル付き）が表示される', () => {
    render(<AlbumCreateForm onSubmit={vi.fn()} isSubmitting={false} error={null} />)
    expect(screen.getByLabelText(/アルバム名/)).toBeInTheDocument()
    expect(screen.getByLabelText(/説明/)).toBeInTheDocument()
  })

  it('ACF-02: 有効入力で送信すると onSubmit が入力値で呼ばれる', async () => {
    const onSubmit = vi.fn()
    render(<AlbumCreateForm onSubmit={onSubmit} isSubmitting={false} error={null} />)
    await userEvent.type(screen.getByLabelText(/アルバム名/), '夏休み')
    await userEvent.click(screen.getByRole('button', { name: /保存/ }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({ title: '夏休み', description: '' })
  })

  it('ACF-03: タイトル未入力で送信するとエラー表示し onSubmit を呼ばない', async () => {
    const onSubmit = vi.fn()
    render(<AlbumCreateForm onSubmit={onSubmit} isSubmitting={false} error={null} />)
    await userEvent.click(screen.getByRole('button', { name: /保存/ }))
    expect(screen.getByRole('alert')).toHaveTextContent(ERROR_MESSAGES.TITLE_REQUIRED)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('ACF-04: タイトル51文字超過でエラー表示し送信させない', async () => {
    const onSubmit = vi.fn()
    render(<AlbumCreateForm onSubmit={onSubmit} isSubmitting={false} error={null} />)
    await userEvent.type(screen.getByLabelText(/アルバム名/), 'あ'.repeat(51))
    await userEvent.click(screen.getByRole('button', { name: /保存/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('50')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('ACF-05: 説明201文字超過でエラー表示し送信させない', async () => {
    const onSubmit = vi.fn()
    render(<AlbumCreateForm onSubmit={onSubmit} isSubmitting={false} error={null} />)
    await userEvent.type(screen.getByLabelText(/アルバム名/), '夏休み')
    // 201文字の説明を直接セット（type は遅いため paste を用いる）
    const desc = screen.getByLabelText(/説明/)
    await userEvent.click(desc)
    await userEvent.paste('あ'.repeat(201))
    await userEvent.click(screen.getByRole('button', { name: /保存/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('200')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('ACF-06: タイトル50文字・説明200文字（境界内最大）は送信できる', async () => {
    const onSubmit = vi.fn()
    render(<AlbumCreateForm onSubmit={onSubmit} isSubmitting={false} error={null} />)
    const title = screen.getByLabelText(/アルバム名/)
    await userEvent.click(title)
    await userEvent.paste('あ'.repeat(50))
    const desc = screen.getByLabelText(/説明/)
    await userEvent.click(desc)
    await userEvent.paste('い'.repeat(200))
    await userEvent.click(screen.getByRole('button', { name: /保存/ }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('ACF-07: 文字数カウンターが現在文字数を反映する', async () => {
    render(<AlbumCreateForm onSubmit={vi.fn()} isSubmitting={false} error={null} />)
    await userEvent.type(screen.getByLabelText(/アルバム名/), '12345')
    expect(screen.getByText('5/50')).toBeInTheDocument()
  })

  it('ACF-08: isSubmitting 中は保存ボタンを無効化し onSubmit を呼ばない', async () => {
    const onSubmit = vi.fn()
    render(<AlbumCreateForm onSubmit={onSubmit} isSubmitting={true} error={null} />)
    const button = screen.getByRole('button', { name: /保存/ })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('ACF-09: error prop があるとサーバーエラーをインライン表示する', () => {
    render(
      <AlbumCreateForm
        onSubmit={vi.fn()}
        isSubmitting={false}
        error={ERROR_MESSAGES.SAVE_FAILED}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      ERROR_MESSAGES.SAVE_FAILED
    )
  })

  it('ACF-10: キャンセルボタンが存在する', () => {
    render(<AlbumCreateForm onSubmit={vi.fn()} isSubmitting={false} error={null} />)
    expect(screen.getByRole('button', { name: /キャンセル/ })).toBeInTheDocument()
  })
})
