import type { Metadata } from "next";
import { Noto_Sans_TC, Roboto_Mono } from "next/font/google";
import "../globals.css";

const sans = Noto_Sans_TC({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "醫天圓小助手 | 嵌入版",
  description: "僅包含聊天小工具的簡化頁面，方便以 iframe 嵌入。",
};

export default function EmbedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" style={{ background: 'transparent', touchAction: 'manipulation' }}>
      <body
        className={`${sans.variable} ${mono.variable} antialiased`}
        style={{ 
          background: 'transparent',
          margin: 0,
          padding: 0,
          overflow: 'hidden',
          touchAction: 'manipulation',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          pointerEvents: 'auto'
        }}
      >
        {children}
      </body>
    </html>
  );
}




