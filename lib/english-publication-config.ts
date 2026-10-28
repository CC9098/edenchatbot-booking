export const ENGLISH_PUBLIC_ORIGIN = 'https://www.edenclinic.hk';
export const ENGLISH_SITEMAP_URL = `${ENGLISH_PUBLIC_ORIGIN}/en/sitemap.xml`;

type PublicationEnvironment = { [key: string]: string | undefined; EDEN_ENGLISH_PUBLICATION?: string; VERCEL_ENV?: string };

// This switch is set deliberately for the published edition. Vercel previews
// retain noindex even when production environment settings have been copied.
export function isEnglishPublished(environment: PublicationEnvironment = process.env): boolean {
  return environment.EDEN_ENGLISH_PUBLICATION === 'published'
    && environment.VERCEL_ENV !== 'preview'
    && environment.VERCEL_ENV !== 'development';
}
