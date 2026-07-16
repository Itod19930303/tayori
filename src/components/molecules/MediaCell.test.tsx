import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Media } from '@/types'
import { MediaCell } from './MediaCell'

// MediaCell はグリッド1セルの molecule（基本設計書 4.6）。画像は <img>、動画は
// 再生アイコンオーバーレイを表示する。props のみで完結し Firestore/Storage 直アクセスしない。

const mockImageMedia = {
  mediaId: 'media-1',
  albumId: 'album-1',
  fileName: 'wedding_photo.jpg',
  contentType: 'image/jpeg',
  downloadUrl: 'https://storage.example.com/wedding_photo.jpg',
  thumbnailUrl: null,
} as unknown as Media

const mockVideoMedia = {
  ...mockImageMedia,
  mediaId: 'media-2',
  fileName: 'meeting_video.mp4',
  contentType: 'video/mp4',
  downloadUrl: 'https://storage.example.com/meeting_video.mp4',
} as unknown as Media

describe('components/molecules/MediaCell', () => {
  it('MC-01: 画像メディアは <img>（object-cover）でサムネイルを表示する', () => {
    render(<MediaCell media={mockImageMedia} />)
    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe(mockImageMedia.downloadUrl)
    expect(img.className).toContain('object-cover')
  })

  it('MC-02: 画像に alt（ファイル名）が付く', () => {
    render(<MediaCell media={mockImageMedia} />)
    expect(screen.getByAltText('wedding_photo.jpg')).toBeInTheDocument()
  })

  it('MC-03: 動画メディアは再生アイコン（play_circle）をオーバーレイ表示する', () => {
    render(<MediaCell media={mockVideoMedia} />)
    expect(screen.getByText('play_circle')).toBeInTheDocument()
  })

  it('MC-04: クリックで onSelect が該当メディアで呼ばれる', async () => {
    const onSelect = vi.fn()
    render(<MediaCell media={mockImageMedia} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith(mockImageMedia)
  })

  it('MC-05: thumbnailUrl があればそちらを優先表示する', () => {
    const withThumb = {
      ...mockImageMedia,
      thumbnailUrl: 'https://storage.example.com/thumb.jpg',
    } as unknown as Media
    render(<MediaCell media={withThumb} />)
    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('https://storage.example.com/thumb.jpg')
  })

  it('MC-06: セルが aspect-square / rounded-xl の設計書4.6スタイルを持つ', () => {
    render(<MediaCell media={mockImageMedia} />)
    const cell = screen.getByRole('button')
    expect(cell.className).toContain('aspect-square')
    expect(cell.className).toContain('rounded-xl')
  })
})
