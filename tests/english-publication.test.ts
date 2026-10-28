import test from 'node:test';
import assert from 'node:assert/strict';
import { englishArticles, englishRoutes } from '../content/english/site';
import { englishPublicationMetadata, englishPublicUrl, englishSitemapEntries, isEnglishPublished } from '../lib/english-publication';

test('English indexing needs explicit publication and remains disabled in Vercel previews', () => {
  assert.equal(isEnglishPublished({}), false);
  assert.equal(isEnglishPublished({ EDEN_ENGLISH_PUBLICATION: 'true' }), false);
  assert.equal(isEnglishPublished({ EDEN_ENGLISH_PUBLICATION: 'published', VERCEL_ENV: 'production' }), true);
  for (const VERCEL_ENV of ['preview', 'development']) {
    assert.equal(isEnglishPublished({ EDEN_ENGLISH_PUBLICATION: 'published', VERCEL_ENV }), false);
  }
  assert.equal(isEnglishPublished({ EDEN_ENGLISH_PUBLICATION: 'published' }), true);
});

test('only known published content declares the confirmed English URL and Chinese counterpart', () => {
  assert.equal(englishPublicUrl('/'), 'https://www.edenclinic.hk/en');
  assert.equal(englishPublicUrl('/journal/example/'), 'https://www.edenclinic.hk/en/journal/example');
  for (const metadata of [englishPublicationMetadata('/', undefined, false), englishPublicationMetadata(undefined, undefined, true)]) {
    assert.deepEqual(metadata.robots, { index: false, follow: false });
    assert.equal(metadata.alternates?.canonical, null);
    assert.deepEqual(metadata.alternates?.languages, {});
  }
  const sourceUrl = englishArticles[0].sourceUrl;
  const metadata = englishPublicationMetadata(`/journal/${englishArticles[0].slug}/`, sourceUrl, true);
  assert.deepEqual(metadata.robots, { index: true, follow: true });
  assert.equal(metadata.alternates?.canonical, englishPublicUrl(`/journal/${englishArticles[0].slug}/`));
  assert.deepEqual(metadata.alternates?.languages, { 'en-HK': metadata.alternates?.canonical, 'zh-Hant-HK': sourceUrl });
  assert.deepEqual(englishPublicationMetadata('/care/', undefined, true).alternates?.languages, {});
});

test('published sitemap includes every content route once with real article dates and mapped alternates', () => {
  assert.deepEqual(englishSitemapEntries(false), []);
  const entries = englishSitemapEntries(true);
  assert.equal(entries.length, englishRoutes.filter(route => route.path !== '/book/').length);
  assert.equal(new Set(entries.map(entry => entry.url)).size, entries.length);
  assert.ok(entries.every(entry => entry.url.startsWith('https://www.edenclinic.hk/en')));
  assert.ok(entries.every(entry => !/\/en\/(book|booking|manage-booking)$/.test(entry.url)));
  for (const article of englishArticles) {
    const entry = entries.find(item => item.url === englishPublicUrl(`/journal/${article.slug}/`));
    assert.ok(entry, article.slug);
    assert.equal(entry.lastModified, `${article.metadata.modified}T00:00:00+08:00`);
    assert.equal(entry.alternates?.languages?.['zh-Hant-HK'], article.sourceUrl);
  }
  assert.equal(entries.find(entry => entry.url === englishPublicUrl('/'))?.lastModified, undefined);
});
