// 情報メモ + 「変更を保存」ボタンを持つ organisms（基本設計書 4.8）。
// 管理者向けの注意文と、確定メンバーの権限編集を確定させる保存操作をまとめる。
// props のみで完結し、実際の保存処理（Firestore 書き込み）は page 層が担う。
// 多重保存を避けるため、保存中（isSaving）または未変更（!isDirty）のときはボタンを非活性にする。
export interface ActionRowProps {
  isDirty: boolean
  isSaving: boolean
  onSave: () => void
}

export function ActionRow({ isDirty, isSaving, onSave }: ActionRowProps) {
  const disabled = !isDirty || isSaving

  return (
    <div className="flex flex-col gap-stack-md md:flex-row md:items-center md:justify-between">
      <p className="font-body-md text-body-md text-on-surface-variant">
        管理者は他の方を招待したり、コンテンツを削除したりできます。
      </p>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        aria-disabled={disabled}
        className="inline-flex h-10 items-center justify-center rounded-lg bg-secondary px-6 font-label-md text-label-md text-on-secondary shadow-md hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        変更を保存
      </button>
    </div>
  )
}
