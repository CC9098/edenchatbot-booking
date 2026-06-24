import type { Metadata, Viewport } from "next";
import { Figtree, Noto_Sans_TC, Noto_Serif_TC, Roboto_Mono } from "next/font/google";
import { NativeOAuthListener } from "@/components/auth/NativeOAuthListener";
import { StaffAuthResume } from "@/components/auth/StaffAuthResume";
import { PatientAppChrome } from "@/components/patient/PatientAppChrome";
import { CrossMethodBanner } from "@/components/member/CrossMethodBanner";
import { clinicStructuredData, jsonLd, SITE_DESCRIPTION, SITE_NAME } from "@/lib/structured-data";
import { buildPublicUrl, getPublicBaseUrl } from "@/lib/public-url";
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
  metadataBase: new URL(getPublicBaseUrl()),
  title: {
    default: `${SITE_NAME} | 中醫診症、針灸、痛症調理與網上預約`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: buildPublicUrl("/"),
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | 中醫診症、針灸、痛症調理與網上預約`,
    description: SITE_DESCRIPTION,
    url: buildPublicUrl("/"),
    images: [
      {
        url: buildPublicUrl("/images/edenclinic-homepage-bg.webp"),
        alt: SITE_NAME,
      },
    ],
    locale: "zh_HK",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | 中醫診症、針灸、痛症調理與網上預約`,
    description: SITE_DESCRIPTION,
    images: [buildPublicUrl("/images/edenclinic-homepage-bg.webp")],
  },
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
    <html lang="zh-Hant-HK">
      <body
        className={`${display.variable} ${sans.variable} ${mono.variable} ${serif.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(clinicStructuredData()) }}
        />
        <NativeOAuthListener />
        <StaffAuthResume />
        <CrossMethodBanner />
        <PatientAppChrome>{children}</PatientAppChrome>
      </body>
    </html>
  );
}
