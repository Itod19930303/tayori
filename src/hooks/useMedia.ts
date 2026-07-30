'use client'

// 単一メディアをリアルタイム購読するフック（基本設計書 4.9）。
// メディアプレビュー単体画面が、対象 mediaId の存在確認（404相当）と表示データ取得に用いる。
// useAlbum の onSnapshot(doc(...)) パターンを踏襲し、データ取得ロジックをフックへ集約することで
// templates 以下は props のみで完結させる（atomic-design.md のデータアクセス制約）。
import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Media } from '@/types'

export interface UseMediaResult {
  media: Media | null
  loading: boolean
  notFound: boolean
}

export function useMedia(albumId: string, mediaId: string): UseMediaResult {
  const [media, setMedia] = useState<Media | null>(null)
  // 購読確定までは loading=true とし、プレビューページが 404 を誤表示しないようにする。
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'albums', albumId, 'media', mediaId),
      (snapshot) => {
        if (snapshot.exists()) {
          setMedia({ ...snapshot.data(), mediaId: snapshot.id } as Media)
          setNotFound(false)
        } else {
          // ドキュメント不在は 404 相当。page 層がその旨を表示する（既知の全面404不具合の解消）。
          setMedia(null)
          setNotFound(true)
        }
        setLoading(false)
      },
      (error) => {
        // permission-denied 等の購読エラー。クラッシュさせずローディングのみ解除する。
        // 非メンバー（403相当）判定は page 層が親アルバムの memberUids で行うため、
        // ここでは notFound（404相当）とは区別してエラーを保持しない。
        // 障害調査のため、状態に保持しないエラーも console.error へ原因を残す
        // （error が undefined でも安全に出力できるよう第2引数へそのまま渡す）。
        console.error('メディア情報の購読に失敗しました', error)
        setLoading(false)
      }
    )

    // アンマウント/引数変更時に購読解除してメモリリークを防ぐ。
    return unsubscribe
  }, [albumId, mediaId])

  return { media, loading, notFound }
}
