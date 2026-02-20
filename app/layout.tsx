import type { Metadata } from "next";
import { Figtree, Noto_Sans_TC, Roboto_Mono } from "next/font/google";
import { NativeOAuthListener } from "@/components/auth/NativeOAuthListener";
import { PatientAppChrome } from "@/components/patient/PatientAppChrome";
import "./globals.css";

const display = Figtree({
  variable: "--font-eden-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sans = Noto_Sans_TC({
  variable: "--font-eden-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = Roboto_Mono({
  variable: "--font-eden-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "醫天圓小助手 | Chatbot Widget",
  description: "Decision-tree chatbot widget for 醫天圓中醫診所，提供預約、收費、診所資訊與諮詢。",
  icons: {
    icon: "/logo-eden.png",
    shortcut: "/logo-eden.png",
    apple: "/logo-eden.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${sans.variable} ${mono.variable} antialiased`}
      >
        <NativeOAuthListener />
        <PatientAppChrome>{children}</PatientAppChrome>
      </body>
    </html>
  );
}
