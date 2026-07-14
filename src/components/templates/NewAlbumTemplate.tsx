// アルバム作成画面のレイアウト骨格（templates 層、実データ非保持）。
// 簡易ページヘッダーと AlbumCreateForm を配置し、フォーム状態一式（onSubmit / isSubmitting /
// error / onCancel）を透過的に渡す。Firestore 書き込み・遷移は page 層の責務とする。
import { AlbumCreateForm, type AlbumCreateFormProps } from '@/components/molecules/AlbumCreateForm'

export type NewAlbumTemplateProps = AlbumCreateFormProps

export function NewAlbumTemplate(props: NewAlbumTemplateProps) {
  return (
    <div className="flex min-h-screen flex-1 flex-col gap-stack-lg bg-background px-margin-mobile py-stack-lg md:px-margin-desktop">
      {/* mx-auto で画面中央へ寄せる。max-w-2xl は auto margin だけでは効かないため
          w-full と併用し、幅を絞ったうえで中央配置する。 */}
      <div
        data-testid="new-album-container"
        className="mx-auto flex w-full max-w-2xl flex-col gap-stack-lg"
      >
        <header>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            新しいアルバム
          </h1>
        </header>

        <AlbumCreateForm {...props} />
      </div>
    </div>
  )
}
