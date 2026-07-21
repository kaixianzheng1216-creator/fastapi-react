import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 助手",
  description: "基于 assistant-ui 构建的 AI 助手",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">
        <div className="flex h-screen flex-col">
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
