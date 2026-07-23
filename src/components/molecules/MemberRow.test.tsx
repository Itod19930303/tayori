import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AlbumMember } from '@/types'
import { MemberRow } from './MemberRow'

// MemberRow はメンバー1行を描画する molecules（props のみで完結・データ取得なし、基本設計書 4.8）。
// 確定メンバーの権限チェックボックス、owner の変更不可、招待中バッジ・取り消し操作を検証する。

const ownerMember = {
  uid: 'owner-uid',
  displayName: 'オーナー太郎',
  email: 'owner@example.com',
  role: 'owner',
  canView: true,
  canPost: true,
  canManage: true,
  joinedAt: { toMillis: () => 0 },
} as unknown as AlbumMember

const editorMember = {
  uid: 'editor-uid',
  displayName: '編集者花子',
  email: 'editor@example.com',
  role: 'editor',
  canView: true,
  canPost: true,
  canManage: false,
  joinedAt: { toMillis: () => 0 },
} as unknown as AlbumMember

const invitedMember = {
  uid: '',
  displayName: 'invitee@example.com',
  email: 'invitee@example.com',
  role: 'viewer',
  canView: true,
  canPost: false,
  canManage: false,
  invited: true,
} as unknown as AlbumMember

describe('components/molecules/MemberRow', () => {
  it('MR-01: 確定メンバーの表示名と権限チェックボックスを表示する', () => {
    render(<MemberRow member={ownerMember} onToggle={vi.fn()} onCancelInvite={vi.fn()} />)
    expect(screen.getByText('オーナー太郎')).toBeInTheDocument()
    expect(screen.getByLabelText(/閲覧/)).toBeInTheDocument()
    expect(screen.getByLabelText(/投稿/)).toBeInTheDocument()
    expect(screen.getByLabelText(/管理/)).toBeInTheDocument()
  })

  it('MR-02: owner 行は lock アイコン表示・checkbox disabled で onToggle が発火しない', async () => {
    const onToggle = vi.fn()
    render(<MemberRow member={ownerMember} onToggle={onToggle} onCancelInvite={vi.fn()} />)
    expect(screen.getByText('lock')).toBeInTheDocument()
    const postCheckbox = screen.getByLabelText(/投稿/) as HTMLInputElement
    expect(postCheckbox).toBeDisabled()
    await userEvent.click(postCheckbox)
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('MR-03: 一般メンバーの checkbox 変更で onToggle(field) が呼ばれる', async () => {
    const onToggle = vi.fn()
    render(<MemberRow member={editorMember} onToggle={onToggle} onCancelInvite={vi.fn()} />)
    await userEvent.click(screen.getByLabelText(/投稿/))
    expect(onToggle).toHaveBeenCalledWith('canPost')
  })

  it('MR-04: 招待中メンバーは「招待中」バッジとメールアドレスを表示する', () => {
    render(<MemberRow member={invitedMember} onToggle={vi.fn()} onCancelInvite={vi.fn()} />)
    expect(screen.getByText('招待中')).toBeInTheDocument()
    expect(screen.getByText('invitee@example.com')).toBeInTheDocument()
  })

  it('MR-05: 招待中行のメニューから「招待を取り消す」で onCancelInvite(email) を呼ぶ', async () => {
    const onCancelInvite = vi.fn()
    render(
      <MemberRow member={invitedMember} onToggle={vi.fn()} onCancelInvite={onCancelInvite} />
    )
    await userEvent.click(screen.getByRole('button', { name: /招待の操作メニュー/ }))
    await userEvent.click(screen.getByRole('button', { name: '招待を取り消す' }))
    expect(onCancelInvite).toHaveBeenCalledWith('invitee@example.com')
  })

  it('MR-06: 確定済み一般メンバー行に削除系操作が無い（今回スコープ外）', () => {
    render(<MemberRow member={editorMember} onToggle={vi.fn()} onCancelInvite={vi.fn()} />)
    expect(screen.queryByText('招待を取り消す')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /メンバーを外す/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /削除/ })).not.toBeInTheDocument()
  })
})
