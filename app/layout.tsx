import type { Metadata, Viewport } from "next";
import { Figtree, Noto_Sans_TC, Noto_Serif_TC, Roboto_Mono } from "next/font/google";
import { NativeOAuthListener } from "@/components/auth/NativeOAuthListener";
import { PatientAppChrome } from "@/components/patient/PatientAppChrome";
import { CrossMethodBanner } from "@/components/member/CrossMethodBanner";
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

const serif = Noto_Serif_TC({
  variable: "--font-eden-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${sans.variable} ${mono.variable} ${serif.variable} antialiased`}
      >
        <NativeOAuthListener />
        <CrossMethodBanner />
        <PatientAppChrome>{children}</PatientAppChrome>
      </body>
    </html>
  );
}
