'use client'

// ログインユーザーのアルバム一覧をリアルタイム購読するフック（基本設計書 4.4）。
// useAuth の currentUser を見て、ログイン済みのときだけ subscribeAlbums を購読する。
// データ取得ロジックを page 層/このフックに集約することで、organisms 以下は
// props のみで完結する純粋な表示コンポーネントに保てる（atomic-design.md）。
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { subscribeAlbums } from '@/lib/firestoreAlbum'
import type { Album } from '@/types'

export interface UseAlbumsResult {
  albums: Album[]
  loading: boolean
}

export function useAlbums(): UseAlbumsResult {
  const { currentUser } = useAuth()
  const [albums, setAlbums] = useState<Album[]>([])
  // 認証状態が確定していても一覧取得は非同期のため、初期は loading=true とし
  // AlbumGrid が空状態ではなくローディングを表示できるようにする。
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 未ログイン時は購読せず、誤って uid 無しで Firestore を叩かないようにする。
    // 状態は初期値（albums:[]）のままとし、リダイレクト判断は page 層の責務とする。
    // （effect 本体での同期 setState は避け、状態更新は購読コールバック内でのみ行う）
    if (!currentUser) {
      return
    }

    const unsubscribe = subscribeAlbums(
      currentUser.uid,
      (next) => {
        setAlbums(next)
        setLoading(false)
      },
      // 購読失敗時はクラッシュさせず、空表示へフォールバックしてローディングを解除する。
      () => {
        setAlbums([])
        setLoading(false)
      }
    )

    // アンマウント/ユーザー変更時に購読解除してメモリリークを防ぐ。
    return unsubscribe
  }, [currentUser])

  return { albums, loading }
}
