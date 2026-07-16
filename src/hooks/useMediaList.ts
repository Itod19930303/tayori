'use client'

// アルバムのメディア一覧をリアルタイム購読するフック（基本設計書 6.4）。
// useAlbum とは独立に albumId を受け取り subscribeMedia を購読する。
// データ取得ロジックをこのフックに集約し、organisms 以下は props のみで完結させる
// （atomic-design.md）。
import { useEffect, useState } from 'react'
import { subscribeMedia } from '@/lib/firestoreMedia'
import type { Media } from '@/types'

export interface UseMediaListResult {
  mediaItems: Media[]
  loading: boolean
}

export function useMediaList(albumId: string): UseMediaListResult {
  const [mediaItems, setMediaItems] = useState<Media[]>([])
  // 一覧取得は非同期のため初期は loading=true とし、MediaGrid が空状態ではなく
  // ローディングを表示できるようにする。
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeMedia(
      albumId,
      (next) => {
        setMediaItems(next)
        setLoading(false)
      },
      // 購読失敗時はクラッシュさせず、空表示へフォールバックしてローディングを解除する。
      () => {
        setMediaItems([])
        setLoading(false)
      }
    )

    // アンマウント/albumId 変更時に購読解除する。
    return unsubscribe
  }, [albumId])

  return { mediaItems, loading }
}
