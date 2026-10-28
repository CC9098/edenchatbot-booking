import type { Metadata, MetadataRoute } from 'next';
import { englishArticles, englishPath, englishRoutes } from '@/content/english/site';
import { ENGLISH_PUBLIC_ORIGIN, isEnglishPublished } from './english-publication-config';
export { ENGLISH_PUBLIC_ORIGIN, ENGLISH_SITEMAP_URL, isEnglishPublished } from './english-publication-config';

export function englishPublicUrl(path: string): string {
  return `${ENGLISH_PUBLIC_ORIGIN}${englishPath(path)}`;
}

export function englishPublicationMetadata(path?: string, chineseUrl?: string, published = isEnglishPublished()): Pick<Metadata, 'robots' | 'alternates'> {
  if (!published || !path) {
    return { robots: { index: false, follow: false }, alternates: { canonical: null, languages: {} } };
  }
  const canonical = englishPublicUrl(path);
  return {
    robots: { index: true, follow: true },
    alternates: {
      canonical,
      languages: chineseUrl ? { 'en-HK': canonical, 'zh-Hant-HK': chineseUrl } : {},
    },
  };
}

export function englishSitemapEntries(published = isEnglishPublished()): MetadataRoute.Sitemap {
  if (!published) return [];
  return englishRoutes.filter(route => route.path !== '/book/').map(route => {
    const article = englishArticles.find(item => `/journal/${item.slug}/` === route.path);
    const chineseUrl = 'chinese' in route ? route.chinese : undefined;
    const url = englishPublicUrl(route.path);
    return {
      url,
      ...(article ? { lastModified: `${article.metadata.modified}T00:00:00+08:00` } : {}),
      changeFrequency: article ? 'monthly' as const : 'weekly' as const,
      priority: route.path === '/' ? 1 : article ? 0.7 : 0.8,
      ...(chineseUrl ? { alternates: { languages: { 'en-HK': url, 'zh-Hant-HK': chineseUrl } } } : {}),
    };
  });
}
