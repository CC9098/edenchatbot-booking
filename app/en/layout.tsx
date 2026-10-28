import type { Metadata } from 'next';
import './fonts.css';
import './site.css';
import './overrides.css';
import './homepage.css';
import { EnglishMain, EnglishSiteHeader } from '@/components/english/EnglishSiteChrome';
import { EnglishFooter } from '@/components/english/EnglishCommon';
import { ENGLISH_PUBLIC_ORIGIN, englishPublicationMetadata, isEnglishPublished } from '@/lib/english-publication';

const defaultTitle = 'Eden Clinic | Chinese medicine in Hong Kong';
const defaultDescription = 'Chinese medicine, acupuncture and care in Central, Jordan and Tsuen Wan.';
const defaultImage = `${isEnglishPublished() ? ENGLISH_PUBLIC_ORIGIN : ''}/english/assets/central.jpeg`;

export const metadata: Metadata = {
  title: { default: defaultTitle, template: '%s — Eden Clinic' },
  description: defaultDescription,
  ...(isEnglishPublished() ? { metadataBase: new URL(ENGLISH_PUBLIC_ORIGIN) } : {}),
  ...englishPublicationMetadata(),
  openGraph: { type: 'website', siteName: 'Eden Clinic', locale: 'en_HK', title: defaultTitle, description: defaultDescription, images: [{ url: defaultImage, alt: 'Eden Clinic, Central' }] },
  twitter: { card: 'summary_large_image', title: defaultTitle, description: defaultDescription, images: [defaultImage] },
};
export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return <div className="eden-english" lang="en-HK"><EnglishSiteHeader /><EnglishMain>{children}</EnglishMain><EnglishFooter /></div>;
}
