import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Media } from '@/types'
import { MediaGrid } from './MediaGrid'

// MediaGrid はメディアのグリッド/空状態/ローディングを描画する organism（基本設計書 4.6）。
// props のみで完結し Firestore/Storage 直アクセスしない。

const mockImageMedia = {
  mediaId: 'media-1',
  fileName: 'wedding_photo.jpg',
  contentType: 'image/jpeg',
  downloadUrl: 'https://storage.example.com/wedding_photo.jpg',
  thumbnailUrl: null,
} as unknown as Media

function makeMedia(id: string): Media {
  return { ...mockImageMedia, mediaId: id } as unknown as Media
}

describe('components/organisms/MediaGrid', () => {
  it('MG-01: メディア1件以上でグリッド（MediaCell）を表示する', () => {
    render(<MediaGrid mediaItems={[mockImageMedia]} loading={false} />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('MG-02: 渡した件数だけ MediaCell を描画する', () => {
    render(
      <MediaGrid
        mediaItems={[makeMedia('m1'), makeMedia('m2'), makeMedia('m3')]}
        loading={false}
      />
    )
    expect(screen.getAllByRole('img')).toHaveLength(3)
  })

  it('MG-03: メディア0件（loading=false）で空状態UIを表示する', () => {
    render(<MediaGrid mediaItems={[]} loading={false} />)
    expect(screen.getByText('家族の絆を未来へ')).toBeInTheDocument()
    expect(screen.getByText(/写真・動画を追加/)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('MG-04: loading=true 中はローディング表示にし空状態を出さない', () => {
    render(<MediaGrid mediaItems={[]} loading={true} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('家族の絆を未来へ')).not.toBeInTheDocument()
  })

  it('MG-05: レスポンシブなグリッドクラスを持つ', () => {
    render(<MediaGrid mediaItems={[makeMedia('m1')]} loading={false} />)
    const grid = screen.getByTestId('media-grid')
    expect(grid.className).toContain('grid-cols-2')
    expect(grid.className).toContain('md:grid-cols-3')
    expect(grid.className).toContain('lg:grid-cols-4')
  })

  it('MG-06: セル選択で onSelect が伝播する', async () => {
    const onSelect = vi.fn()
    render(
      <MediaGrid mediaItems={[mockImageMedia]} loading={false} onSelect={onSelect} />
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith(mockImageMedia)
  })
})
