import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { englishArticles, englishBookingUrl, englishClinics, englishDoctors, englishPages, englishRoutes, englishServices } from '../content/english/site';
import { CLINIC_BY_ID, type ClinicId } from '../shared/clinic-data';

test('prepared English editions retain all 100 WordPress source identities and artwork', () => {
  assert.equal(englishArticles.length, 100);
  assert.equal(new Set(englishArticles.map(article => article.id)).size, 100);
  assert.equal(new Set(englishArticles.map(article => article.slug)).size, 100);
  assert.equal(englishRoutes.length, 142);
  for (const article of englishArticles) {
    assert.match(article.sourceUrl, /^https:\/\/(www\.)?edenclinic\.hk\//);
    assert.ok(article.sourceSnapshot);
    assert.ok(article.body.trim().split(/\s+/).length >= 200, `${article.slug}: complete edition`);
    assert.ok(article.body.includes('\n## '), `${article.slug}: article sections retained`);
    assert.ok(englishRoutes.some(route => route.path === `/journal/${article.slug}/` && 'article_id' in route && route.article_id === article.id));
    assert.ok(existsSync(path.join(process.cwd(), 'public/english/assets/article-art', article.artwork.svg)));
    assert.ok(existsSync(path.join(process.cwd(), 'public/english/assets/article-art', article.artwork.svg.replace(/\.svg$/, '.png'))));
  }
});

test('booking handoffs use existing localized flow and preserve practitioner/clinic', () => {
  const booking = new URL(englishBookingUrl('lee', 'central'), 'http://localhost');
  assert.equal(booking.pathname, '/en/booking');
  assert.equal(booking.searchParams.get('lang'), 'en');
  assert.equal(booking.searchParams.get('doctor'), 'lee');
  assert.equal(booking.searchParams.get('clinic'), 'central');
  assert.equal(booking.searchParams.get('source'), 'eden-english-site');
});

test('English contact methods resolve the current shared clinic records', () => {
  for (const clinic of englishClinics) {
    const shared = CLINIC_BY_ID[clinic.id as ClinicId];
    assert.equal(clinic.name, shared.nameEn);
    assert.equal(clinic.phone, shared.phones[0]);
    assert.equal(clinic.whatsappUrl, shared.whatsappUrl);
    assert.equal(clinic.map, shared.googleMapUrl);
  }
});

test('English current team and booking links exclude the departed practitioner', () => {
  assert.deepEqual(englishDoctors.map(doctor => doctor.id), ['chan', 'lee', 'hon', 'chau', 'wong', 'cheung', 'leung']);
  assert.ok(!englishRoutes.some(route => route.path === '/practitioners/cheungmy/'));
  assert.ok(englishServices.every(service => !service.doctors.includes('cheungmy')));
  for (const doctor of ['cheungmy', 'wong', 'leung', 'unknown']) {
    assert.equal(new URL(englishBookingUrl(doctor), 'http://localhost').searchParams.has('doctor'), false);
  }
});

test('English clinic hours retain the latest published Wednesday closure', () => {
  const tsuenWan = englishClinics.find(clinic => clinic.id === 'tsuenwan')!;
  assert.deepEqual(tsuenWan.hours, [
    'Monday, Tuesday, Thursday–Sunday: 10:30–14:00, 15:30–19:00',
    'Closed on Wednesdays and public holidays',
  ]);
  assert.equal(CLINIC_BY_ID.tsuenwan.hoursText, '週一、二、四至日 10:30-14:00，15:30-19:00；週三及公眾假期休息');
  assert.ok(englishClinics.find(clinic => clinic.id === 'jordan')!.hours.includes('Saturday: 11:00–18:30'));
});

test('brochure fragments contain local English navigation and no stale booking-language notice', () => {
  const snapshot = JSON.parse(readFileSync(new URL('../content/english/site.json', import.meta.url), 'utf8'));
  for (const page of Object.values(snapshot.pages) as { html: string }[]) {
    assert.doesNotMatch(page.html, /(?:href|src)="\/(?:assets|journal|care|clinics|book|practitioners|fees|first-visit|about)\//);
    assert.doesNotMatch(page.html, /Chinese-language steps|English editorial adaptation|AI-generated|local preview/i);
    assert.doesNotMatch(page.html, /<script\b|\son\w+=/i);
  }
});

test('legacy founder, privacy and treatment content survives the English migration', () => {
  const founder = englishPages['/about/founders/'].html;
  const concepts = ['1. “Round Sky” is endlessly moving.', '2. “Round Sky” connects to 3-levels reconciliation.', '3.'];
  assert.ok(concepts.every(concept => founder.includes(concept)));
  assert.ok(founder.indexOf(concepts[0]) < founder.indexOf(concepts[1]));
  assert.match(founder, /reconcile with our God/);
  assert.match(founder, /ready to experience the healing from God/);
  assert.match(founder, /Best wishes,<br\/>Dr\. Leung Chun-wai/);
  const privacy = englishPages['/privacy-policy/'].html;
  for (const topic of ['Purpose of collection of personal data', 'Security', 'Retaining Information', 'Disclose &amp; transfer', 'Changes &amp; Enquiry']) {
    assert.ok(privacy.includes(topic), topic);
  }
  assert.match(privacy, /access and correct your personal data/);
  assert.doesNotMatch(privacy, /<p>term<\/p>/);
  const treatments = englishPages['/treatments/'].html;
  for (const treatment of ['Moxibustion', 'Ear acupressure', 'Pediatric tui-na', 'Dressing medicine', 'Combination therapy']) {
    assert.ok(treatments.includes(treatment), treatment);
  }
  assert.match(treatments, /href="\/en\/acupuncture"/);
  assert.match(englishPages['/journal/acupuncture-for-cancer-related-chronic-pain/'].html, /placebo effect/);
  assert.match(englishPages['/journal/acupuncture-for-cancer-related-chronic-pain/'].html, /https:\/\/www\.cancer\.gov\//);
  for (const brochure of ['/privacy-policy/', '/about/founders/', '/treatments/', '/acupuncture/', '/journal/acupuncture-for-cancer-related-chronic-pain/']) {
    assert.ok(englishRoutes.some(route => route.path === brochure), brochure);
  }
});

test('legacy research library preserves document access and attributed case context', () => {
  const library = englishPages['/research/'].html;
  for (const path of ['/research/scoping-herbal-medicine-evidence/', '/research/herbs-and-antimicrobial-resistance/', '/research/herbal-medicine-recurrent-uti/', '/research/herbal-medicine-atopic-dermatitis/', '/research/herbal-medicine-irritable-bowel-syndrome/', '/research/lcs101-breast-cancer-study/', '/research/pregnancy-after-herbal-treatment/'] as const) {
    assert.ok(englishRoutes.some(route => route.path === path), path);
    assert.ok(library.includes(`/en${path.replace(/\/$/, '')}`), path);
    assert.match(englishPages[path].html, /<time datetime="2021-/);
    assert.match(englishPages[path].html, /Resource from/);
  }
  for (const path of ['/research/scoping-herbal-medicine-evidence/', '/research/herbs-and-antimicrobial-resistance/', '/research/herbal-medicine-recurrent-uti/', '/research/herbal-medicine-atopic-dermatitis/', '/research/herbal-medicine-irritable-bowel-syndrome/', '/research/lcs101-breast-cancer-study/'] as const) {
    assert.match(englishPages[path].html, /href="https:\/\/www\.edenclinic\.hk\/wp-content\/uploads\/2021\/09\/[^" ]+\.pdf"/);
    assert.doesNotMatch(englishPages[path].html, /\[pdf-embedder|\/eden\/wp-content/);
  }
  const caseStudy = englishPages['/research/pregnancy-after-herbal-treatment/'].html;
  assert.match(caseStudy, /<blockquote cite="https:\/\/www\.ncbi\.nlm\.nih\.gov\/pmc\/articles\/PMC5597078\/">/);
  assert.match(caseStudy, /failed to conceive after fertilized embryo transferring/);
  assert.match(caseStudy, /restrain the growth of uterus fibroids/);
  assert.match(englishPages['/constitution-questionnaire/'].html, /docs\.google\.com\/forms\/d\/e\/1FAIpQLSfkBp6jcwsD8pRhe7TTNpczI4SvbN12oiN5wh5MEYL6ZNwKKw\/viewform/);
  assert.match(englishPages['/home-visit/'].html, /difficulty travelling to a clinic/);
  assert.doesNotMatch(englishPages['/home-visit/'].html, /in 2 days|blood pressure|speed up your recovery/);
});
