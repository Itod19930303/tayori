'use client'

// 権限管理ページ（pages 層、基本設計書 4.8 / 6.6 / 6.7 / 7.3 / 8.1）。
// upload/page.tsx と同じ三段ガード（認証 → アルバム読込 → myMember?.canManage）を適用し、
// canManage メンバー（admin/owner）のみ権限編集・招待を許可する。403判定の「前」に
// useAcceptInvite を実行し、招待済みユーザーの自動受諾を担保する。データ取得は useAlbum /
// usePendingInvites に集約し、書き込みは firestorePermissions のラッパー経由で行う。
// templates 以下は props のみで完結させる（atomic-design.md）。
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useAlbum } from '@/hooks/useAlbum'
import { usePendingInvites } from '@/hooks/usePendingInvites'
import { useAcceptInvite } from '@/hooks/useAcceptInvite'
import { useLogout } from '@/hooks/useLogout'
import {
  createInvite,
  cancelInvite,
  updateInvite,
  updateAlbumMembers,
  type InvitePreset,
} from '@/lib/firestorePermissions'
import {
  PermissionsTemplate,
  type InlineMessage,
} from '@/components/templates/PermissionsTemplate'
import type { PermissionField } from '@/components/molecules/MemberRow'
import { AuthedShell } from '@/components/organisms/AuthedShell'
import { NoticeScreen } from '@/components/molecules/NoticeScreen'
import type { AlbumMember } from '@/types'
import { ERROR_MESSAGES } from '@/lib/messages/errorMessages'
import { SUCCESS_MESSAGES } from '@/lib/messages/successMessages'

// 認証・データ確認中のフルスクリーンスピナー（ちらつき・誤判定防止、基本設計書 7.4）。
function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-background">
      <span
        role="status"
        aria-label="読み込み中"
        className="size-8 animate-spin rounded-full border-4 border-outline-variant border-t-primary"
      />
    </div>
  )
}

export default function PermissionsPage() {
  const params = useParams()
  const albumId = params.albumId as string
  const { currentUser, loading: authLoading } = useAuth()
  const { album, loading: albumLoading } = useAlbum(albumId)
  const { invites } = usePendingInvites(albumId)
  const { handleLogout, logoutError } = useLogout()
  const router = useRouter()

  // 403判定の「前」に受諾処理を実行し、招待済みユーザーを自動的にメンバー化する（設計書6.7）。
  useAcceptInvite(albumId)

  // 確定メンバーの編集用ローカル state。チェックボックス変更はここへ反映し、保存で永続化する。
  const [confirmedMembers, setConfirmedMembers] = useState<AlbumMember[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [message, setMessage] = useState<InlineMessage | null>(null)

  // 未ログインなら /login へ誘導し、returnUrl に権限管理画面パスを保持する（設計書7.4）。
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace(
        `/login?returnUrl=${encodeURIComponent(`/albums/${albumId}/permissions`)}`
      )
    }
  }, [authLoading, currentUser, router, albumId])

  // アルバム読込完了時に確定メンバーをローカルへ取り込む。以降の編集はローカルで行う。
  useEffect(() => {
    if (album) setConfirmedMembers(album.members ?? [])
  }, [album])

  // 表示用リスト: 確定メンバー（編集中のローカル値）+ 招待中メンバー（購読値）を合成する。
  // 招待中は invited:true で MemberRow が区別して描画する（設計書4.8）。
  const displayMembers = useMemo(
    () => [...confirmedMembers, ...invites],
    [confirmedMembers, invites]
  )

  // 確定メンバーの権限チェックボックス変更。ローカルへ反映し、保存対象（isDirty）とする。
  const handleToggle = (member: AlbumMember, field: PermissionField) => {
    setConfirmedMembers((prev) =>
      prev.map((m) => (m.uid === member.uid ? { ...m, [field]: !m[field] } : m))
    )
    setIsDirty(true)
  }

  // 招待中メンバーの権限プリセット変更は、確定メンバーの保存とは経路を分け、
  // 対象の pendingInvites ドキュメントを個別更新する（設計書4.8 経路分離）。
  const handleChangePreset = (member: AlbumMember, field: PermissionField) => {
    const next = !member[field]
    updateInvite(albumId, member.email, { [field]: next }).catch((error) => {
      console.error('招待の権限更新に失敗しました', error)
      setMessage({ text: ERROR_MESSAGES.SAVE_FAILED, tone: 'error' })
    })
  }

  // 招待取り消し（pendingInvites ドキュメント削除）。確定メンバー削除は行わない（設計書6.7）。
  const handleCancelInvite = (email: string) => {
    cancelInvite(albumId, email).catch((error) => {
      console.error('招待の取り消しに失敗しました', error)
      setMessage({ text: ERROR_MESSAGES.CANCEL_FAILED, tone: 'error' })
    })
  }

  // 確定メンバーの権限編集を保存する。invited:true の一時オブジェクトは confirmedMembers に
  // 含まれないため、members/memberUids は自然に確定メンバーのみとなる（設計書4.8）。
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const memberUids = confirmedMembers.map((m) => m.uid)
      await updateAlbumMembers(albumId, confirmedMembers, memberUids)
      setMessage({ text: SUCCESS_MESSAGES.PERMISSIONS_SAVED, tone: 'success' })
      setIsDirty(false)
    } catch (error) {
      console.error('権限の保存に失敗しました', error)
      setMessage({ text: ERROR_MESSAGES.SAVE_FAILED, tone: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  // メール招待。正規化・保存は createInvite が担い、成功時は完了メッセージ + モーダルを閉じる。
  const handleInvite = async (email: string, preset: InvitePreset) => {
    if (!currentUser) return
    try {
      await createInvite(albumId, email, preset, currentUser)
      setMessage({ text: SUCCESS_MESSAGES.INVITE_REGISTERED, tone: 'success' })
      setIsInviteOpen(false)
    } catch (error) {
      console.error('招待の登録に失敗しました', error)
      setMessage({ text: ERROR_MESSAGES.SAVE_FAILED, tone: 'error' })
    }
  }

  // 認証確認中はちらつき防止のためスピナーを表示する。
  if (authLoading) return <LoadingScreen />
  // 未ログインならリダイレクト中のため UI を描画しない。
  if (!currentUser) return null
  // アルバム読み込み中は権限判定ができないためスピナーを表示する。
  if (albumLoading) return <LoadingScreen />

  // canManage 権限が無いメンバー（editor/viewer）・非メンバーには 403相当を表示する（設計書7.3）。
  // 403通知も AuthedShell 内で表示し、ログイン済みユーザーが権限を持たない場合でも
  // 共通ヘッダー（ログアウト導線）を維持する（CodeRabbit Major指摘）。
  const myMember = album?.members?.find((m) => m.uid === currentUser.uid)
  if (!myMember?.canManage) {
    return (
      <AuthedShell
        currentUser={currentUser}
        onLogoutClick={handleLogout}
        logoutError={logoutError}
      >
        <NoticeScreen message={ERROR_MESSAGES.FORBIDDEN} />
      </AuthedShell>
    )
  }

  // TopHeader を最上部の共通バーとして配置し、既存のページヘッダー（戻る導線・見出し）は
  // その下段に維持する（設計書 4.10）。
  return (
    <AuthedShell
      currentUser={currentUser}
      onLogoutClick={handleLogout}
      logoutError={logoutError}
    >
      <PermissionsTemplate
        albumTitle={album?.title ?? ''}
        albumId={albumId}
        members={displayMembers}
        onToggle={handleToggle}
        onChangePreset={handleChangePreset}
        onCancelInvite={handleCancelInvite}
        onSave={handleSave}
        isDirty={isDirty}
        isSaving={isSaving}
        isInviteOpen={isInviteOpen}
        onInviteOpen={() => setIsInviteOpen(true)}
        onInviteClose={() => setIsInviteOpen(false)}
        onInvite={handleInvite}
        message={message}
        onBack={() => router.push(`/albums/${albumId}`)}
      />
    </AuthedShell>
  )
}
