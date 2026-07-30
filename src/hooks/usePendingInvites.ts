'use client'

// 招待中（未受諾）一覧をリアルタイム購読するフック（基本設計書 4.8）。
// albums/{albumId}/pendingInvites サブコレクションを onSnapshot で購読し、権限管理画面が
// 確定メンバーと同じ MemberRow で扱えるよう、表示用 AlbumMember（invited:true・uid空・
// displayName にメール表示）へ変換して返す。データ取得ロジックをここに集約し、templates 以下は
// props のみで完結させる（atomic-design.md）。useAlbum と同じ購読・エラーフォールバック方針に従う。
import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AlbumMember, PendingInvite } from '@/types'

export interface UsePendingInvitesResult {
  invites: AlbumMember[]
  loading: boolean
}

export function usePendingInvites(albumId: string): UsePendingInvitesResult {
  const [invites, setInvites] = useState<AlbumMember[]>([])
  // 購読確定までは loading=true とし、page 層が招待行の有無を誤判定しないようにする。
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'albums', albumId, 'pendingInvites'),
      (snapshot) => {
        // ドキュメントID（正規化済みメール）を「正」として email/displayName に用い、
        // 権限値は招待レコードの値をそのまま反映する。invited:true で確定メンバーと区別する。
        const converted = snapshot.docs.map((d) => {
          const data = d.data() as PendingInvite
          return {
            uid: '',
            displayName: d.id,
            email: d.id,
            role: data.role,
            canView: data.canView,
            canPost: data.canPost,
            canManage: data.canManage,
            joinedAt: data.invitedAt,
            invited: true,
          } as AlbumMember
        })
        setInvites(converted)
        setLoading(false)
      },
      (error) => {
        // 購読エラー（permission-denied 等）はクラッシュさせず空フォールバックし、
        // ローディングのみ解除する（画面を壊さない）。
        // 障害調査のため、フォールバックで握りつぶす前に原因を console.error へ残す。
        console.error('招待一覧の購読に失敗しました', error)
        setInvites([])
        setLoading(false)
      }
    )

    // アンマウント/albumId 変更時に購読解除してメモリリークを防ぐ。
    return unsubscribe
  }, [albumId])

  return { invites, loading }
}
