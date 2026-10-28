/** Verify rendered public English routes/assets without calling booking APIs. */
import fs from 'node:fs';
const base = new URL(process.argv[2] || 'http://127.0.0.1:3128');
const published = process.argv.includes('--published');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) throw new Error('Use a local server for this check.');
const { routes } = JSON.parse(fs.readFileSync(new URL('../../content/english/site.json', import.meta.url), 'utf8'));
const errors = [], assets = new Set();
let count = 0;
async function check(route) {
  const url = new URL(`/en${route.path === '/' ? '' : route.path.replace(/\/$/, '')}`, base);
  const response = await fetch(url, { redirect: 'manual' });
  if (route.path === '/book/') {
    if (response.status !== 307 || !response.headers.get('location')?.startsWith('/en/booking?')) errors.push(`${url.pathname}: bad booking redirect`);
    return;
  }
  if (response.status !== 200) { errors.push(`${url.pathname}: ${response.status}`); return; }
  const html = await response.text();
  if (!new RegExp(`<meta name="robots" content="${published ? 'index, follow' : 'noindex, nofollow'}"`).test(html)) errors.push(`${url.pathname}: incorrect indexing state`);
  if (!html.includes('lang="en-HK"')) errors.push(`${url.pathname}: content language missing`);
  if (published) {
    const canonical = `https://www.edenclinic.hk${url.pathname}`;
    if (!html.includes(`<link rel="canonical" href="${canonical}"`)) errors.push(`${url.pathname}: publication canonical missing`);
    if (route.chinese) {
      const alternate = html.match(/hrefLang="zh-Hant-HK" href="([^"]+)"/)?.[1];
      if (!alternate || new URL(alternate).href !== new URL(route.chinese).href) errors.push(`${url.pathname}: Chinese alternate missing`);
    }
  } else if (/rel="canonical"/.test(html)) errors.push(`${url.pathname}: unexpected public canonical`);
  if (!/<h1[\s>]/.test(html)) errors.push(`${url.pathname}: H1 missing`);
  if (html.includes('Chinese-language steps')) errors.push(`${url.pathname}: stale language notice`);
  for (const [, src] of html.matchAll(/src="(\/english\/assets\/[^"?]+)"/g)) assets.add(src);
  count++;
}
// Limit concurrency so a development server is not overwhelmed.
for (let offset = 0; offset < routes.length; offset += 6) await Promise.all(routes.slice(offset, offset + 6).map(check));
for (const asset of assets) {
  const response = await fetch(new URL(asset, base), { method: 'HEAD' });
  if (!response.ok) errors.push(`${asset}: ${response.status}`);
}
const handoff = await fetch(new URL('/en/book?doctor=lee&clinic=central&visitType=followup&lang=en&source=legacy-entry', base), { redirect: 'manual' });
const handoffUrl = new URL(handoff.headers.get('location') || '/', base);
if (handoff.status !== 307 || handoffUrl.pathname !== '/en/booking' || handoffUrl.searchParams.get('doctor') !== 'lee' || handoffUrl.searchParams.get('clinic') !== 'central' || handoffUrl.searchParams.get('visitType') !== 'followup' || handoffUrl.searchParams.get('lang') !== 'en' || handoffUrl.searchParams.get('source') !== 'legacy-entry') errors.push('booking alias: query handoff failed');
const unknown = await fetch(new URL('/en/not-a-real-page', base));
if (unknown.status !== 404) errors.push(`unknown route: ${unknown.status}`);
const sitemap = await fetch(new URL('/en/sitemap.xml', base));
const sitemapXml = await sitemap.text();
const sitemapUrls = Array.from(sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g), match => match[1]);
if (!sitemap.ok || sitemapUrls.length !== (published ? count : 0)) errors.push(`English sitemap: expected ${published ? count : 0} URLs, received ${sitemapUrls.length} (${sitemap.status})`);
if (published && sitemapUrls.some(url => !url.startsWith('https://www.edenclinic.hk/en'))) errors.push('English sitemap: incorrect public origin');
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`${count} English pages (${published ? 'published' : 'preview'} metadata), sitemap, booking redirect, 404 and ${assets.size} image assets verified.`);
