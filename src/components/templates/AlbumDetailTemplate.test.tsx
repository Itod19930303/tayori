import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Album, Media } from '@/types'
import { AlbumDetailTemplate } from './AlbumDetailTemplate'

// AlbumDetailTemplate はアルバム詳細のレイアウト骨格（templates 層、実データ非保持）。
// ヘッダー（アルバム名・メンバー数・更新日時・アップロードボタン）と MediaGrid を配置する。

const mockAlbum = {
  albumId: 'album-1',
  title: '湖畔で過ごした夏休み',
  memberUids: ['test-uid'],
  members: [
    { uid: 'test-uid' },
    { uid: 'u2' },
  ],
  mediaCount: 1,
  createdAt: { toMillis: () => 0 },
  updatedAt: { toMillis: () => 0 },
} as unknown as Album

const mockImageMedia = {
  mediaId: 'media-1',
  fileName: 'wedding_photo.jpg',
  contentType: 'image/jpeg',
  downloadUrl: 'https://storage.example.com/wedding_photo.jpg',
  thumbnailUrl: null,
} as unknown as Media

describe('components/templates/AlbumDetailTemplate', () => {
  it('ADT-01: アルバム名・メンバー数・更新日時のヘッダーを表示する', () => {
    render(
      <AlbumDetailTemplate
        album={mockAlbum}
        mediaItems={[mockImageMedia]}
        loading={false}
        onUploadClick={vi.fn()}
      />
    )
    expect(screen.getByText('湖畔で過ごした夏休み')).toBeInTheDocument()
    // メンバー数（2人）が表示される
    expect(screen.getByText(/2/)).toBeInTheDocument()
  })

  it('ADT-02: 「アップロード」ボタン押下で onUploadClick が呼ばれる', async () => {
    const onUploadClick = vi.fn()
    render(
      <AlbumDetailTemplate
        album={mockAlbum}
        mediaItems={[mockImageMedia]}
        loading={false}
        onUploadClick={onUploadClick}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /アップロード/ }))
    expect(onUploadClick).toHaveBeenCalledTimes(1)
  })

  it('ADT-03: mediaItems / loading を MediaGrid へ透過的に渡す', () => {
    render(
      <AlbumDetailTemplate
        album={mockAlbum}
        mediaItems={[mockImageMedia]}
        loading={false}
        onUploadClick={vi.fn()}
      />
    )
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('ADT-04: 背景に bg-background を用いる', () => {
    const { container } = render(
      <AlbumDetailTemplate
        album={mockAlbum}
        mediaItems={[]}
        loading={false}
        onUploadClick={vi.fn()}
      />
    )
    expect(container.firstChild).toHaveClass('bg-background')
  })
})
