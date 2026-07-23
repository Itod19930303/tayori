import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InviteModal } from './InviteModal'
import { SUCCESS_MESSAGES } from '@/lib/messages/successMessages'

// InviteModal は2導線（URLコピー / メール招待）の招待モーダル（molecules、基本設計書 4.8）。
// props（open / albumId / onInvite / onClose）のみで完結し、Firestore へ直接アクセスしない。
// クリップボード書き込み・メール正規化・不正入力の抑止・閉じる操作を検証する。

const writeText = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  writeText.mockResolvedValue(undefined)
  Object.assign(navigator, { clipboard: { writeText } })
  vi.stubGlobal('location', { origin: 'https://tayori.example.com' } as Location)
})

describe('components/molecules/InviteModal', () => {
  it('IM-01: URLコピー導線でアルバムURLをクリップボードへ書き込む', async () => {
    render(
      <InviteModal open albumId="album-1" onInvite={vi.fn()} onClose={vi.fn()} />
    )
    await userEvent.click(screen.getByRole('button', { name: /リンクをコピー/ }))
    expect(writeText).toHaveBeenCalledWith(
      'https://tayori.example.com/albums/album-1'
    )
    expect(screen.getByText(SUCCESS_MESSAGES.LINK_COPIED)).toBeInTheDocument()
  })

  it('IM-02: メール招待で onInvite(正規化メール, preset) を呼ぶ', async () => {
    const onInvite = vi.fn()
    render(
      <InviteModal open albumId="album-1" onInvite={onInvite} onClose={vi.fn()} />
    )
    await userEvent.type(
      screen.getByLabelText(/メールアドレス/),
      'Invitee@Example.com'
    )
    await userEvent.selectOptions(screen.getByLabelText(/権限/), 'viewer')
    await userEvent.click(screen.getByRole('button', { name: '招待する' }))
    expect(onInvite).toHaveBeenCalledWith('invitee@example.com', {
      role: 'viewer',
      canView: true,
      canPost: false,
      canManage: false,
    })
  })

  it('IM-03: 不正メール形式では onInvite を呼ばずエラー表示する', async () => {
    const onInvite = vi.fn()
    render(
      <InviteModal open albumId="album-1" onInvite={onInvite} onClose={vi.fn()} />
    )
    await userEvent.type(screen.getByLabelText(/メールアドレス/), 'abc')
    await userEvent.click(screen.getByRole('button', { name: '招待する' }))
    expect(onInvite).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('IM-04: 前後に空白のみのメールは無効扱いにする', async () => {
    const onInvite = vi.fn()
    render(
      <InviteModal open albumId="album-1" onInvite={onInvite} onClose={vi.fn()} />
    )
    await userEvent.type(screen.getByLabelText(/メールアドレス/), '   ')
    await userEvent.click(screen.getByRole('button', { name: '招待する' }))
    expect(onInvite).not.toHaveBeenCalled()
  })

  it('IM-05: 閉じるボタンで onClose を呼ぶ', async () => {
    const onClose = vi.fn()
    render(
      <InviteModal open albumId="album-1" onInvite={vi.fn()} onClose={onClose} />
    )
    await userEvent.click(screen.getByRole('button', { name: /閉じる/ }))
    expect(onClose).toHaveBeenCalled()
  })

  it('IM-06: open=false のときは何も描画しない', () => {
    const { container } = render(
      <InviteModal open={false} albumId="album-1" onInvite={vi.fn()} onClose={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
