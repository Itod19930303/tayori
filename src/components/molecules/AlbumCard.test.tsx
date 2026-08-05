import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Album, AlbumMember } from '@/types'
import { AlbumCard } from './AlbumCard'

// AlbumCard は molecules（props のみで完結、Firebase 直アクセス禁止）。
// アルバム名・更新日時・メンバー数バッジ・表紙/プレースホルダーの描画を検証する（基本設計書 4.4）。
//
// カバレッジ注記: formatUpdatedAt() 内の `album.updatedAt?.toMillis?.() ?? 0` および
// `album.members?.length ?? 0` の `??` フォールバック分岐は意図的に未テスト。
// Album型（5.1）では updatedAt/members は必須フィールドであり、Firestoreからの実データで
// undefined になることはない。テストで無理に undefined を注入しても「型を無視した入力に
// 対する防御コードが動くこと」を確認するだけで実バグの検出には繋がらないため、
// 費用対効果の観点でスキップしている（レビュー2026-07-14で許容判断）。


function makeMember(uid: string): AlbumMember {
  return {
    uid,
    displayName: `user-${uid}`,
    email: `${uid}@example.com`,
    role: 'owner',
    canView: true,
    canPost: true,
    canManage: true,
    joinedAt: { toMillis: () => 0 } as unknown as AlbumMember['joinedAt'],
  }
}

function makeAlbum(overrides: Partial<Album> = {}): Album {
  return {
    albumId: 'album-1',
    title: '湖畔で過ごした夏休み',
    description: '',
    ownerId: 'test-uid',
    memberUids: ['test-uid'],
    adminUids: ['test-uid'],
    members: [makeMember('test-uid')],
    mediaCount: 0,
    createdAt: { toMillis: () => 0 } as unknown as Album['createdAt'],
    updatedAt: { toMillis: () => 0 } as unknown as Album['updatedAt'],
    ...overrides,
  }
}

describe('components/molecules/AlbumCard', () => {
  it('ACD-01: アルバム名を表示する', () => {
    render(<AlbumCard album={makeAlbum()} />)
    expect(screen.getByText('湖畔で過ごした夏休み')).toBeInTheDocument()
  })

  it('ACD-02: 更新日時を整形して表示する', () => {
    render(<AlbumCard album={makeAlbum()} />)
    // toMillis()=0 → 1970年。整形済み日時が表示されることを確認する
    expect(screen.getByText(/1970/)).toBeInTheDocument()
  })

  it('ACD-03: メンバー数バッジを表示する（3名）', () => {
    const album = makeAlbum({
      members: [makeMember('a'), makeMember('b'), makeMember('c')],
      memberUids: ['a', 'b', 'c'],
    })
    render(<AlbumCard album={album} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('ACD-04: メンバー1名でもバッジが表示される', () => {
    render(<AlbumCard album={makeAlbum()} />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('ACD-05a: coverImageUrl があれば表紙画像を表示する', () => {
    render(
      <AlbumCard
        album={makeAlbum({ coverImageUrl: 'https://example.com/cover.jpg' })}
      />
    )
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/cover.jpg')
    expect(img).toHaveAttribute('alt')
  })

  it('ACD-05b: coverImageUrl が無ければプレースホルダーを表示する', () => {
    render(<AlbumCard album={makeAlbum()} />)
    // プレースホルダー領域を data 属性で識別する（実画像を持たない）
    expect(screen.getByTestId('album-cover-placeholder')).toBeInTheDocument()
  })

  it('ACD-07: カードクリックで onSelect が該当アルバムを引数に1回呼ばれる', async () => {
    const album = makeAlbum()
    const onSelect = vi.fn()
    render(<AlbumCard album={album} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(album)
  })

  it('ACD-08: onSelect 未指定時にクリックしても例外にならず描画を維持する', async () => {
    render(<AlbumCard album={makeAlbum()} />)
    const card = screen.getByRole('button')
    await userEvent.click(card)
    // オプショナルチェーン防御で例外が出ず、カード内容が保持される
    expect(screen.getByText('湖畔で過ごした夏休み')).toBeInTheDocument()
  })

  it('ACD-09: ルートが <button type="button"> でカードデザインと表示内容を非破壊で維持する', () => {
    const album = makeAlbum({ coverImageUrl: 'https://example.com/cover.jpg' })
    render(<AlbumCard album={album} />)
    const card = screen.getByRole('button')
    // ネイティブボタンセマンティクス（role="button" は明示しない）
    expect(card.tagName).toBe('BUTTON')
    expect(card).toHaveAttribute('type', 'button')
    expect(card).not.toHaveAttribute('role')
    // カードデザインの維持
    expect(card.className).toContain('rounded-xl')
    expect(card.className).toContain('custom-shadow')
    expect(card.className).toContain('overflow-hidden')
    expect(card.className).toContain('cursor-pointer')
    // 表示内容（タイトル・更新日時・メンバー数・表紙img[alt]）がボタン内に維持される
    expect(card).toContainElement(screen.getByText('湖畔で過ごした夏休み'))
    expect(card).toContainElement(screen.getByText(/1970/))
    expect(card).toContainElement(screen.getByText('1'))
    const img = screen.getByRole('img')
    expect(card).toContainElement(img)
    expect(img).toHaveAttribute('alt')
  })
})
