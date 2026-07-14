import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Album, AlbumMember } from '@/types'
import { HomeTemplate } from './HomeTemplate'

// HomeTemplate は templates 層（実データ非保持）。ページ見出し・作成ボタン・AlbumGrid の配置と
// props の透過的な伝播、背景トークンを検証する（基本設計書 4.4）。

function makeAlbum(title: string): Album {
  const member: AlbumMember = {
    uid: 'u',
    displayName: 'u',
    email: 'u@example.com',
    role: 'owner',
    canView: true,
    canPost: true,
    canManage: true,
    joinedAt: { toMillis: () => 0 } as unknown as AlbumMember['joinedAt'],
  }
  return {
    albumId: 'a1',
    title,
    description: '',
    ownerId: 'u',
    memberUids: ['u'],
    members: [member],
    mediaCount: 0,
    createdAt: { toMillis: () => 0 } as unknown as Album['createdAt'],
    updatedAt: { toMillis: () => 0 } as unknown as Album['updatedAt'],
  }
}

describe('components/templates/HomeTemplate', () => {
  it('HT-01: 見出し「アルバム」と作成ボタンを表示する', () => {
    render(
      <HomeTemplate
        albums={[makeAlbum('夏休み')]}
        loading={false}
        onCreateClick={vi.fn()}
      />
    )
    expect(screen.getByRole('heading', { name: 'アルバム' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /新しいアルバム/ })
    ).toBeInTheDocument()
  })

  it('HT-02: 作成ボタン押下で onCreateClick が呼ばれる', async () => {
    const onCreateClick = vi.fn()
    render(
      <HomeTemplate albums={[]} loading={false} onCreateClick={onCreateClick} />
    )
    await userEvent.click(screen.getByRole('button', { name: /新しいアルバム/ }))
    expect(onCreateClick).toHaveBeenCalledTimes(1)
  })

  it('HT-03: albums/loading を AlbumGrid へ透過的に渡す', () => {
    render(
      <HomeTemplate
        albums={[makeAlbum('湖畔で過ごした夏休み')]}
        loading={false}
        onCreateClick={vi.fn()}
      />
    )
    expect(screen.getByText('湖畔で過ごした夏休み')).toBeInTheDocument()
  })

  it('HT-04: ルート要素が bg-background を持つ', () => {
    const { container } = render(
      <HomeTemplate albums={[]} loading={false} onCreateClick={vi.fn()} />
    )
    expect((container.firstChild as HTMLElement).className).toContain(
      'bg-background'
    )
  })
})
