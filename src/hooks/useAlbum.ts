'use client'

// 単一アルバムをリアルタイム購読するフック（基本設計書 4.6）。
// アルバム詳細/アップロードページが存在確認（404相当）・メンバー判定（403相当）に用いる。
// データ取得ロジックをこのフックに集約することで、templates 以下は props のみで完結させる
// （atomic-design.md はデータ取得を hooks/pages に集約する方針）。
import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Album } from '@/types'

export interface UseAlbumResult {
  album: Album | null
  loading: boolean
  notFound: boolean
}

export function useAlbum(albumId: string): UseAlbumResult {
  const [album, setAlbum] = useState<Album | null>(null)
  // 購読確定までは loading=true とし、詳細ページが 403/404 を誤表示しないようにする。
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'albums', albumId),
      (snapshot) => {
        if (snapshot.exists()) {
          setAlbum({ ...snapshot.data(), albumId: snapshot.id } as Album)
          setNotFound(false)
        } else {
          // ドキュメント不在は 404 相当。page 層がその旨を表示する。
          setAlbum(null)
          setNotFound(true)
        }
        setLoading(false)
      },
      () => {
        // permission-denied 等の購読エラー。クラッシュさせずローディングのみ解除する。
        // 非メンバー（403相当）判定は page 層が album.memberUids で行うため、
        // ここでは notFound（404相当）とは区別してエラーを保持しない設計とする。
        setLoading(false)
      }
    )

    // アンマウント/albumId 変更時に購読解除してメモリリークを防ぐ。
    return unsubscribe
  }, [albumId])

  return { album, loading, notFound }
}
