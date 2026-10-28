import type { MetadataRoute } from 'next';
import { englishSitemapEntries } from '@/lib/english-publication';

export default function sitemap(): MetadataRoute.Sitemap {
  return englishSitemapEntries();
}
