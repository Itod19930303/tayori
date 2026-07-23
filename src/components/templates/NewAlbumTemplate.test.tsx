import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NewAlbumTemplate } from './NewAlbumTemplate'
import { ERROR_MESSAGES } from '@/lib/messages/errorMessages'

// NewAlbumTemplate は templates 層（実データ非保持）。AlbumCreateForm の配置と
// props（isSubmitting/error）の透過的な伝播、背景トークンを検証する（基本設計書 4.5）。

describe('components/templates/NewAlbumTemplate', () => {
  it('NAT-01: AlbumCreateForm を配置して描画する', () => {
    render(
      <NewAlbumTemplate onSubmit={vi.fn()} isSubmitting={false} error={null} />
    )
    expect(screen.getByLabelText(/アルバム名/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /保存/ })).toBeInTheDocument()
  })

  it('NAT-02: error を AlbumCreateForm へ透過的に渡す', () => {
    render(
      <NewAlbumTemplate
        onSubmit={vi.fn()}
        isSubmitting={false}
        error={ERROR_MESSAGES.SAVE_FAILED}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      ERROR_MESSAGES.SAVE_FAILED
    )
  })

  it('NAT-03: ルート要素が bg-background を持つ', () => {
    const { container } = render(
      <NewAlbumTemplate onSubmit={vi.fn()} isSubmitting={false} error={null} />
    )
    expect((container.firstChild as HTMLElement).className).toContain(
      'bg-background'
    )
  })

  it('NAT-04: フォームを内包するコンテナが画面中央に配置される（mx-auto + max-w）', () => {
    const { container } = render(
      <NewAlbumTemplate onSubmit={vi.fn()} isSubmitting={false} error={null} />
    )
    const wrapper = container.querySelector('[data-testid="new-album-container"]')
    expect(wrapper?.className).toContain('mx-auto')
    expect(wrapper?.className).toContain('max-w-2xl')
  })
})
