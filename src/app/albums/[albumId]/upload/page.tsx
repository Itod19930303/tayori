'use client'

// アップロードページ（pages 層、基本設計書 4.7 / 6.3 / 7.3 / 8.1 #3〜#5）。
// useAuth でガードし、canPost 権限を確認したうえで、ファイル選択→validateMediaFile→
// uploadFile（進捗コールバックで state 更新）→createMediaDoc のオーケストレーションを行う。
// 実処理（Storage/Firestore）はライブラリへ委ね、状態管理と遷移をこの層に集約する。
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useAlbum } from '@/hooks/useAlbum'
import { useLogout } from '@/hooks/useLogout'
import { validateMediaFile } from '@/lib/validators'
import { uploadFile } from '@/lib/uploadFile'
import { createMediaDoc } from '@/lib/firestoreMedia'
import { UploadTemplate, type FileValidationError } from '@/components/templates/UploadTemplate'
import { TopHeader } from '@/components/organisms/TopHeader'
import type { UploadItemState } from '@/components/molecules/UploadItem'
import { ERROR_MESSAGES } from '@/lib/messages/errorMessages'

// 認証・データ確認中のフルスクリーンスピナー（ちらつき防止、基本設計書 7.4）。
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

// 権限不足（canPost=false）時の中央メッセージ表示（基本設計書 7.3）。
function NoticeScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-background px-margin-mobile text-center">
      <p className="font-body-md text-body-md text-on-surface-variant">
        {message}
      </p>
    </div>
  )
}

export default function UploadPage() {
  const params = useParams()
  const albumId = params.albumId as string
  const { currentUser, loading: authLoading } = useAuth()
  const { album, loading: albumLoading } = useAlbum(albumId)
  const { handleLogout, logoutError } = useLogout()
  const router = useRouter()

  const [uploads, setUploads] = useState<UploadItemState[]>([])
  const [fileErrors, setFileErrors] = useState<FileValidationError[]>([])

  // アンマウント時クリーンアップ用に最新の uploads を保持する ref。
  // クリーンアップ effect の依存配列を空にするとマウント時点の空配列をクロージャで固定してしまい
  // 残存 previewUrl を解放できない（stale closure）。ref を経由して常に最新値を参照する。
  const uploadsRef = useRef<UploadItemState[]>(uploads)

  // 未ログインなら /login へ誘導し、returnUrl にアップロード画面パスを保持する（基本設計書 7.4）。
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace(
        `/login?returnUrl=${encodeURIComponent(`/albums/${albumId}/upload`)}`
      )
    }
  }, [authLoading, currentUser, router, albumId])

  // 描画のたびに最新の uploads を ref へ同期し、アンマウント時クリーンアップから参照できるようにする。
  useEffect(() => {
    uploadsRef.current = uploads
  }, [uploads])

  // 画面離脱時に残っている確定前プレビューの Object URL を解放し、メモリリークを防ぐ
  // （previewUrl の生成/解放は page 層に集約する。設計書4.7）。
  // uploadsRef を参照することで、アンマウント時点で実際に残っている pending 行の previewUrl を確実に解放する。
  useEffect(() => {
    return () => {
      uploadsRef.current.forEach((u) => {
        if (u.previewUrl) URL.revokeObjectURL(u.previewUrl)
      })
    }
    // アンマウント時のみ実行する。最新 uploads は uploadsRef 経由で参照するため依存は空でよい。
  }, [])

  // 進捗に応じて該当アップロード行のみ差分更新する。
  const updateItem = (key: string, patch: Partial<UploadItemState>) => {
    setUploads((prev) =>
      prev.map((u) => (u.mediaId === key ? { ...u, ...patch } : u))
    )
  }

  // 1ファイルのアップロード実処理。uploadFile→createMediaDoc を直列に行い、
  // 途中で失敗した場合は error 状態にして再試行導線を出す（成功扱いにしない。設計書8.1 #6）。
  const runUpload = async (file: File, key: string, isRetry: boolean) => {
    if (!currentUser) return
    updateItem(key, {
      status: isRetry ? 'retrying' : 'uploading',
      progress: 0,
      errorMessage: undefined,
    })
    try {
      const result = await uploadFile(albumId, file, {
        onProgress: (progress) =>
          updateItem(key, { status: 'uploading', progress }),
      })
      await createMediaDoc(
        albumId,
        {
          mediaId: result.mediaId,
          fileName: file.name,
          contentType: file.type,
          size: file.size,
          storagePath: result.storagePath,
          downloadUrl: result.downloadUrl,
        },
        currentUser
      )
      updateItem(key, { status: 'done', progress: 100 })
    } catch (error) {
      // 実際の原因（Storage/Firestore失敗）はコンソールで切り分けられるようログへ残す。
      console.error('アップロードに失敗しました', error)
      updateItem(key, {
        status: 'error',
        errorMessage: ERROR_MESSAGES.UPLOAD_NETWORK_FAILED,
      })
    }
  }

  // フェーズ1: ファイル選択時は形式・サイズを検証し、通過分のみ確定前（pending）行として
  // 一覧へ追加する。ここでは uploadFile も Firestore 書き込みも呼ばず、サムネイル用の
  // previewUrl を生成するだけに留める。無効ファイルはインラインエラーとして表示し、有効分の
  // 追加は止めない（設計書6.3 フェーズ1 / 8.1 #4・#5）。
  const handleSelectFiles = (files: FileList) => {
    const errors: FileValidationError[] = []
    const accepted: UploadItemState[] = []

    Array.from(files).forEach((file) => {
      const message = validateMediaFile(file)
      if (message) {
        errors.push({ fileName: file.name, message })
        return
      }
      accepted.push({
        file,
        mediaId: crypto.randomUUID(),
        status: 'pending',
        progress: 0,
        selected: false,
        previewUrl: URL.createObjectURL(file),
      })
    })

    setFileErrors(errors)

    if (accepted.length > 0) {
      setUploads((prev) => [...prev, ...accepted])
    }
  }

  // フェーズ2: チェックボックス操作。該当 pending 行の選択状態をトグルする（ローカルstateのみ）。
  const handleToggleSelect = (key: string) => {
    setUploads((prev) =>
      prev.map((u) =>
        u.mediaId === key && u.status === 'pending'
          ? { ...u, selected: !u.selected }
          : u
      )
    )
  }

  // フェーズ2: 「選択項目を削除」。選択中の pending 行を一覧から除外し、previewUrl を解放する。
  // ローカル state 操作のみで完結し、Firestore/Storage の実削除APIは一切呼ばない
  // （設計書6.3 フェーズ2 / restrictions.md 削除禁止対象は実削除API）。
  const handleDeleteSelected = () => {
    setUploads((prev) =>
      prev.filter((u) => {
        const remove = u.status === 'pending' && u.selected
        if (remove && u.previewUrl) URL.revokeObjectURL(u.previewUrl)
        return !remove
      })
    )
  }

  // フェーズ3: 「保存」押下で、残っている pending 行を waiting へ遷移させ、各行のアップロードを
  // 並列に起動する（既存の uploadBytesResumable 並列方式を踏襲。設計書6.3 フェーズ3）。
  const handleSave = () => {
    const targets = uploads.filter((u) => u.status === 'pending')
    if (targets.length === 0) return
    setUploads((prev) =>
      prev.map((u) =>
        u.status === 'pending' ? { ...u, status: 'waiting' as const } : u
      )
    )
    targets.forEach((u) => {
      void runUpload(u.file, u.mediaId, false)
    })
  }

  // エラー行クリック時: 同じファイルで再試行する（設計書6.3 再試行処理）。
  const handleRetry = (key: string) => {
    const item = uploads.find((u) => u.mediaId === key)
    if (!item) return
    void runUpload(item.file, key, true)
  }

  // ヘッダー戻るリンク & 完了モーダル「戻る」の遷移先。permissions/page.tsx の onBack と同一パターンで
  // 遷移先は /albums/${albumId} 固定（設計書4.7 戻る導線の仕様）。
  const handleBack = () => {
    router.push(`/albums/${albumId}`)
  }

  // 完了モーダル「続けてアップロードする」。uploads を空配列へリセットし、ファイル再選択可能な初期状態へ戻す
  // （allDone が false になり完了モーダルは自動的に閉じる）。同時に確定前行の previewUrl を解放し
  // fileErrors をクリアして、メモリリークと古いエラー残留を防ぐ（設計書4.7 v2.5 / 6.3）。
  const handleResetUploads = () => {
    uploads.forEach((u) => {
      if (u.previewUrl) URL.revokeObjectURL(u.previewUrl)
    })
    setUploads([])
    setFileErrors([])
  }

  // 保存ボタン活性条件: 確定前（pending）行が1件以上あること（設計書4.7）。
  const canSave = uploads.some((u) => u.status === 'pending')

  // 認証確認中はちらつき防止のためスピナーを表示する。
  if (authLoading) {
    return <LoadingScreen />
  }

  // 未ログインならリダイレクト中のため UI を描画しない。
  if (!currentUser) {
    return null
  }

  // アルバム読み込み中は権限判定ができないためスピナーを表示する。
  if (albumLoading) {
    return <LoadingScreen />
  }

  // 投稿権限（canPost）が無いメンバーにはアップロードUIを出さない（設計書7.3）。
  const myMember = album?.members?.find((m) => m.uid === currentUser.uid)
  if (!myMember?.canPost) {
    return <NoticeScreen message={ERROR_MESSAGES.POST_FORBIDDEN} />
  }

  // TopHeader を最上部の共通バーとして配置し、既存のページヘッダー（戻る導線・見出し）は
  // その下段に維持する（設計書 4.10）。
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <TopHeader currentUser={currentUser} onLogoutClick={handleLogout} />
      {logoutError && (
        <p
          role="alert"
          aria-live="assertive"
          className="bg-error-container px-margin-mobile py-stack-sm text-center font-body-md text-body-md text-error md:px-margin-desktop"
        >
          {logoutError}
        </p>
      )}
      <UploadTemplate
        uploads={uploads}
        onSelectFiles={handleSelectFiles}
        onSave={handleSave}
        canSave={canSave}
        onRetry={handleRetry}
        onToggleSelect={handleToggleSelect}
        onDeleteSelected={handleDeleteSelected}
        fileErrors={fileErrors}
        onBack={handleBack}
        onResetUploads={handleResetUploads}
        albumName={album?.title}
      />
    </div>
  )
}
