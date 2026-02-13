import type { Metadata } from "next";
import { Noto_Sans_TC, Roboto_Mono } from "next/font/google";
import "./globals.css";

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
  title: "醫天圓小助手 | Chatbot Widget",
  description: "Decision-tree chatbot widget for 醫天圓中醫診所，提供預約、收費、診所資訊與諮詢。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sans.variable} ${mono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
