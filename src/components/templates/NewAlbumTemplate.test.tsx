import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NewAlbumTemplate } from './NewAlbumTemplate'

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
        error="保存に失敗しました。時間をおいて再試行してください。"
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      '保存に失敗しました。時間をおいて再試行してください。'
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
})
