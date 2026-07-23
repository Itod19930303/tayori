import { describe, it, expect } from 'vitest'
import type { Media } from '@/types'
import { getPreviewUrl } from './mediaUrl'

// getPreviewUrl は provider ごとにプレビュー用URLを解決する単一の分岐点（基本設計書 4.9 / 5.3）。
// 将来の Cloudinary/Mux 移行時に画面側の影響を最小化する安全弁として、URL生成をここへ集約する。
// MVP では全 provider が downloadUrl を返すが、分岐の存在自体（provider設計）を検証する。

function makeMedia(overrides: Partial<Media>): Media {
  return {
    mediaId: 'media-1',
    albumId: 'album-1',
    fileName: 'photo.jpg',
    contentType: 'image/jpeg',
    size: 1024,
    storagePath: 'albums/album-1/media-1/photo.jpg',
    downloadUrl: 'https://storage.example.com/photo.jpg',
    uploadedBy: 'test-uid',
    uploaderName: 'テスト太郎',
    createdAt: { toMillis: () => 0 } as unknown as Media['createdAt'],
    provider: 'firebase',
    ...overrides,
  } as Media
}

describe('lib/mediaUrl - getPreviewUrl', () => {
  it('MU-01: provider=firebase は downloadUrl を返す', () => {
    const media = makeMedia({ provider: 'firebase' })
    expect(getPreviewUrl(media)).toBe(media.downloadUrl)
  })

  it('MU-02: provider=cloudinary は（MVPでは）downloadUrl を返す', () => {
    const media = makeMedia({ provider: 'cloudinary' })
    expect(getPreviewUrl(media)).toBe(media.downloadUrl)
  })

  it('MU-03: provider=mux は（MVPでは）downloadUrl を返す', () => {
    const media = makeMedia({ provider: 'mux' })
    expect(getPreviewUrl(media)).toBe(media.downloadUrl)
  })

  it('MU-04: 未知の provider でも downloadUrl にフォールバックする（default節）', () => {
    const media = makeMedia({ provider: 'unknown' as unknown as Media['provider'] })
    expect(getPreviewUrl(media)).toBe(media.downloadUrl)
  })
})
