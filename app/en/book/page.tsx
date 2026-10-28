import { redirect } from 'next/navigation';

// This alias reads request query parameters; it must not enter the static article renderer.
export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default function EnglishBookRedirect({ searchParams = {} }: { searchParams?: SearchParams }) {
  const source = typeof searchParams.source === 'string' && searchParams.source
    ? searchParams.source
    : 'eden-english-site';
  const query = new URLSearchParams({ lang: 'en', source });
  for (const key of ['doctor', 'clinic', 'visitType']) {
    const value = searchParams[key];
    if (typeof value === 'string') query.set(key, value);
  }
  redirect(`/en/booking?${query}`);
}
