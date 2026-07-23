import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AlbumMember } from '@/types'
import { PermissionTable } from './PermissionTable'

// PermissionTable は MemberRow を N 行並べる organisms（Firestore 直アクセスなし、基本設計書 4.8）。
// メンバー行の描画・招待中バッジ・ハンドラ透過を検証する。

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

const editor = {
  uid: 'editor-uid',
  displayName: '編集者花子',
  email: 'editor@example.com',
  role: 'editor',
  canView: true,
  canPost: true,
  canManage: false,
  joinedAt: { toMillis: () => 0 },
} as unknown as AlbumMember

const invited = {
  uid: '',
  displayName: 'invitee@example.com',
  email: 'invitee@example.com',
  role: 'viewer',
  canView: true,
  canPost: false,
  canManage: false,
  invited: true,
} as unknown as AlbumMember

describe('components/organisms/PermissionTable', () => {
  it('PT-01: members を MemberRow × N として表示し招待中バッジを付ける', () => {
    render(
      <PermissionTable
        members={[owner, editor, invited]}
        onToggle={vi.fn()}
        onChangePreset={vi.fn()}
        onCancelInvite={vi.fn()}
      />
    )
    expect(screen.getByText('オーナー太郎')).toBeInTheDocument()
    expect(screen.getByText('編集者花子')).toBeInTheDocument()
    expect(screen.getByText('invitee@example.com')).toBeInTheDocument()
    expect(screen.getAllByText('招待中')).toHaveLength(1)
  })

  it('PT-02: 確定メンバー1名（owner のみ）で1行のみ表示し招待中バッジは出ない', () => {
    render(
      <PermissionTable
        members={[owner]}
        onToggle={vi.fn()}
        onChangePreset={vi.fn()}
        onCancelInvite={vi.fn()}
      />
    )
    expect(screen.getByText('オーナー太郎')).toBeInTheDocument()
    expect(screen.queryByText('招待中')).not.toBeInTheDocument()
  })

  it('PT-03: 招待取り消し操作が onCancelInvite へ透過して呼ばれる', async () => {
    const onCancelInvite = vi.fn()
    render(
      <PermissionTable
        members={[owner, invited]}
        onToggle={vi.fn()}
        onChangePreset={vi.fn()}
        onCancelInvite={onCancelInvite}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /招待の操作メニュー/ }))
    await userEvent.click(screen.getByRole('button', { name: '招待を取り消す' }))
    expect(onCancelInvite).toHaveBeenCalledWith('invitee@example.com')
  })
})
