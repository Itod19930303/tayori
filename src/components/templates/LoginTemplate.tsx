// ログイン画面のレイアウト骨格（templates 層）。実データを持たず、構造（中央配置）のみに関心を持つ。
// 受け取った props は LoginCard へ透過的に渡すだけとし、データ取得やログイン処理は page 層が担う。
import { LoginCard, type LoginCardProps } from '@/components/molecules/LoginCard'

export function LoginTemplate(props: LoginCardProps) {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-background px-margin-mobile">
      <LoginCard {...props} />
    </div>
  )
}
