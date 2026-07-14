import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

// アプリのルートレイアウト。Heritage & Heart のフォント（見出し=Source Serif 4 /
// 本文=Be Vietnam Pro / アイコン=Material Symbols）を Google Fonts から読み込み、
// 全画面で認証状態を共有するため AuthProvider で children をラップする（基本設計書 3.2 / 6.1）。
export const metadata: Metadata = {
  title: "たより",
  description: "LINEで流れてしまう画像・動画を、チームで一元管理できる共有アルバムアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@600;700&family=Be+Vietnam+Pro:wght@400;600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700,FILL@0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background font-body-md text-on-surface">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
