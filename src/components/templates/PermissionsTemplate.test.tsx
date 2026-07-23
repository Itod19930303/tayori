import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AlbumMember } from '@/types'
import { PermissionsTemplate } from './PermissionsTemplate'
import { SUCCESS_MESSAGES } from '@/lib/messages/successMessages'

// PermissionsTemplate は権限管理画面のレイアウト骨格（templates、実データ非保持・基本設計書 4.8）。
// ヘッダー・PermissionTable・ActionRow・InviteModal を配置し、props を透過する。
// Firestore/Storage へ直接アクセスしない。

const owner = {
  uid: 'owner-uid',
  displayName: 'オーナー太郎',
  email: 'owner@example.com',
  role: 'owner',
  canView: true,
  canPost: true,
  canManage: true,
  joinedAt: { toMillis: () => 0 },
} as unknown as AlbumMember

function renderTemplate(overrides: Record<string, unknown> = {}) {
  return render(
    <PermissionsTemplate
      albumTitle="湖畔で過ごした夏休み"
      albumId="album-1"
      members={[owner]}
      onToggle={vi.fn()}
      onChangePreset={vi.fn()}
      onCancelInvite={vi.fn()}
      onSave={vi.fn()}
      isDirty={false}
      isSaving={false}
      isInviteOpen={false}
      onInviteOpen={vi.fn()}
      onInviteClose={vi.fn()}
      onInvite={vi.fn()}
      message={null}
      {...overrides}
    />
  )
}

describe('components/templates/PermissionsTemplate', () => {
  it('PMT-01: ヘッダー・テーブル・保存ボタン・招待ボタンを配置する', () => {
    renderTemplate()
    expect(screen.getByText('アルバムの閲覧権限')).toBeInTheDocument()
    expect(screen.getByText('オーナー太郎')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '変更を保存' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /家族を招待/ })).toBeInTheDocument()
  })

  it('PMT-02: 「家族を招待」ボタンで onInviteOpen を呼ぶ', async () => {
    const onInviteOpen = vi.fn()
    renderTemplate({ onInviteOpen })
    await userEvent.click(screen.getByRole('button', { name: /家族を招待/ }))
    expect(onInviteOpen).toHaveBeenCalledTimes(1)
  })

  it('PMT-03: ルート要素が bg-background で、招待モーダルは isInviteOpen で制御される', () => {
    const { container, rerender } = renderTemplate()
    expect(container.firstChild).toHaveClass('bg-background')
    // isInviteOpen=false のときモーダル本体（メールアドレス入力）は描画されない
    expect(screen.queryByLabelText(/メールアドレス/)).not.toBeInTheDocument()
    rerender(
      <PermissionsTemplate
        albumTitle="湖畔で過ごした夏休み"
        albumId="album-1"
        members={[owner]}
        onToggle={vi.fn()}
        onChangePreset={vi.fn()}
        onCancelInvite={vi.fn()}
        onSave={vi.fn()}
        isDirty={false}
        isSaving={false}
        isInviteOpen
        onInviteOpen={vi.fn()}
        onInviteClose={vi.fn()}
        onInvite={vi.fn()}
        message={null}
      />
    )
    expect(screen.getByLabelText(/メールアドレス/)).toBeInTheDocument()
  })

  it('PMT-04: message（成功/失敗）をインライン表示する', () => {
    renderTemplate({
      message: { text: SUCCESS_MESSAGES.PERMISSIONS_SAVED, tone: 'success' },
    })
    expect(screen.getByText(SUCCESS_MESSAGES.PERMISSIONS_SAVED)).toBeInTheDocument()
  })
})
