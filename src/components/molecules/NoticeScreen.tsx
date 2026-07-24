// 403/404 相当の中央メッセージ表示（molecules 層、基本設計書 4.6 / 4.8 / 4.9）。
// アルバム詳細 / メディアプレビュー / 権限管理の3ページで、外側コンテナと本文のマークアップ・クラスが
// 完全一致したまま各ページ内へローカル複製されていたため、単一の変更理由（通知画面の見た目/配置の仕様変更）で
// 一括保守できるよう共通コンポーネントへ切り出す（development.md 共通化基準1〜4を充足）。
// AuthedShell（TopHeader）の下段に配置する前提のため、min-h-screen ではなく flex-1 で残余領域を占める。
// props のみで完結し、データ取得を行わない純粋表示コンポーネント（atomic-design.md molecules 判定基準）。
export interface NoticeScreenProps {
  // 利用者へ提示する通知文言（403/404 の各メッセージなど）。表示のみに用いる。
  message: string
}

export function NoticeScreen({ message }: NoticeScreenProps) {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-margin-mobile text-center">
      <p className="font-body-md text-body-md text-on-surface-variant">
        {message}
      </p>
    </div>
  )
}
