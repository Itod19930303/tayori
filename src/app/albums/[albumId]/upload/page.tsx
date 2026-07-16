'use client'

// アップロードページ（pages 層、基本設計書 4.7 / 6.3 / 7.3 / 8.1 #3〜#5）。
// useAuth でガードし、canPost 権限を確認したうえで、ファイル選択→validateMediaFile→
// uploadFile（進捗コールバックで state 更新）→createMediaDoc のオーケストレーションを行う。
// 実処理（Storage/Firestore）はライブラリへ委ね、状態管理と遷移をこの層に集約する。
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useAlbum } from '@/hooks/useAlbum'
import { validateMediaFile } from '@/lib/validators'
import { uploadFile } from '@/lib/uploadFile'
import { createMediaDoc } from '@/lib/firestoreMedia'
import { UploadTemplate, type FileValidationError } from '@/components/templates/UploadTemplate'
import type { UploadItemState } from '@/components/molecules/UploadItem'

// アップロード中のネットワーク切断時に表示するメッセージ（基本設計書 8.1 #3）。
const NETWORK_ERROR_MESSAGE =
  'ネットワークが切断されました。タップして再試行してください。'

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
  const router = useRouter()

  const [uploads, setUploads] = useState<UploadItemState[]>([])
  const [fileErrors, setFileErrors] = useState<FileValidationError[]>([])

  // 未ログインなら /login へ誘導し、returnUrl にアップロード画面パスを保持する（基本設計書 7.4）。
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace(
        `/login?returnUrl=${encodeURIComponent(`/albums/${albumId}/upload`)}`
      )
    }
  }, [authLoading, currentUser, router, albumId])

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
      updateItem(key, { status: 'error', errorMessage: NETWORK_ERROR_MESSAGE })
    }
  }

  // ファイル選択時: 形式・サイズを検証し、通過分のみ waiting 行を追加してアップロードを開始する。
  // 無効ファイルはインラインエラーとして表示し、有効分の処理は止めない（設計書8.1 #4・#5）。
  const handleSelectFiles = (files: FileList) => {
    const errors: FileValidationError[] = []
    const accepted: { file: File; key: string }[] = []

    Array.from(files).forEach((file) => {
      const message = validateMediaFile(file)
      if (message) {
        errors.push({ fileName: file.name, message })
        return
      }
      accepted.push({ file, key: crypto.randomUUID() })
    })

    setFileErrors(errors)

    if (accepted.length > 0) {
      setUploads((prev) => [
        ...prev,
        ...accepted.map(({ file, key }) => ({
          file,
          mediaId: key,
          status: 'waiting' as const,
          progress: 0,
        })),
      ])
      accepted.forEach(({ file, key }) => {
        void runUpload(file, key, false)
      })
    }
  }

  // エラー行クリック時: 同じファイルで再試行する（設計書6.3 再試行処理）。
  const handleRetry = (key: string) => {
    const item = uploads.find((u) => u.mediaId === key)
    if (!item) return
    void runUpload(item.file, key, true)
  }

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
    return <NoticeScreen message="投稿権限がありません。" />
  }

  return (
    <UploadTemplate
      uploads={uploads}
      onSelectFiles={handleSelectFiles}
      onRetry={handleRetry}
      fileErrors={fileErrors}
    />
  )
}
