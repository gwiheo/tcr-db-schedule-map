import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_KR } from "next/font/google";

import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TCR DB 엔진 개발 스케줄",
  description: "2026년 8월부터 12월까지 TCR DB 엔진 개발 전체 트랙을 마인드맵과 주간 스케줄 테이블로 관리합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
