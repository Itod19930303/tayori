import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Album, AlbumMember } from '@/types'
import { AlbumGrid } from './AlbumGrid'

// AlbumGrid は organisms（props のみで完結、Firestore/Storage 直アクセス禁止）。
// 空状態・カードグリッド・ローディング表示・レスポンシブクラスを検証する（基本設計書 4.4）。

function makeAlbum(id: string, title: string): Album {
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
    albumId: id,
    title,
    description: '',
    ownerId: 'u',
    memberUids: ['u'],
    adminUids: ['u'],
    members: [member],
    mediaCount: 0,
    createdAt: { toMillis: () => 0 } as unknown as Album['createdAt'],
    updatedAt: { toMillis: () => 0 } as unknown as Album['updatedAt'],
  }
}

describe('components/organisms/AlbumGrid', () => {
  it('AG-01: アルバム1件でカードを表示する', () => {
    render(
      <AlbumGrid albums={[makeAlbum('a1', '夏休み')]} loading={false} onCreateClick={vi.fn()} />
    )
    expect(screen.getByText('夏休み')).toBeInTheDocument()
  })

  it('AG-02: 複数アルバムを渡した数だけカードを描画する', () => {
    render(
      <AlbumGrid
        albums={[
          makeAlbum('a1', 'アルバム1'),
          makeAlbum('a2', 'アルバム2'),
          makeAlbum('a3', 'アルバム3'),
        ]}
        loading={false}
        onCreateClick={vi.fn()}
      />
    )
    expect(screen.getByText('アルバム1')).toBeInTheDocument()
    expect(screen.getByText('アルバム2')).toBeInTheDocument()
    expect(screen.getByText('アルバム3')).toBeInTheDocument()
  })

  it('AG-03: 0件（loading=false）で空状態を表示する', () => {
    render(<AlbumGrid albums={[]} loading={false} onCreateClick={vi.fn()} />)
    expect(screen.getByText('まだアルバムがありません')).toBeInTheDocument()
  })

  it('AG-06: 空状態にはヘッダーと同じ導線の作成ボタンを表示し、クリックでonCreateClickが呼ばれる（UX: ユーザーの視線が集まる空状態内で即アクションできるようにする）', async () => {
    const user = userEvent.setup()
    const onCreateClick = vi.fn()
    render(<AlbumGrid albums={[]} loading={false} onCreateClick={onCreateClick} />)
    const button = screen.getByRole('button', { name: /アルバムを作成/ })
    await user.click(button)
    expect(onCreateClick).toHaveBeenCalledTimes(1)
  })

  it('AG-04: loading=true の間はローディング表示にし空状態を出さない', () => {
    render(<AlbumGrid albums={[]} loading={true} onCreateClick={vi.fn()} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('まだアルバムがありません')).not.toBeInTheDocument()
  })

  it('AG-05: レスポンシブなグリッドクラスを持つ', () => {
    const { container } = render(
      <AlbumGrid albums={[makeAlbum('a1', '夏休み')]} loading={false} onCreateClick={vi.fn()} />
    )
    const grid = container.querySelector('[data-testid="album-grid"]')
    expect(grid?.className).toContain('grid-cols-1')
    expect(grid?.className).toContain('sm:grid-cols-2')
    expect(grid?.className).toContain('md:grid-cols-3')
    expect(grid?.className).toContain('lg:grid-cols-4')
    expect(grid?.className).toContain('gap-gutter')
  })
})
