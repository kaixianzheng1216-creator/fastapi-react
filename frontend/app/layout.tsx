import type { Metadata } from "next";
import { QueryProvider } from "@/app/query-provider";
import { ThemeProvider } from "@/app/theme-provider";
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
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
