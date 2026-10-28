#!/usr/bin/env python3
"""Import the existing prepared English editions. Never fetch or write WordPress."""
from pathlib import Path
import argparse, importlib.util, json, re, shutil, subprocess
from datetime import datetime, timezone
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True, help='Frozen english-preview source folder')
parser.add_argument('--replace-existing', action='store_true', help='Explicitly replace maintained English content after backing it up')
args = parser.parse_args()
source = args.source.resolve()
snapshot_path = ROOT / 'content/english/site.json'
if snapshot_path.exists() and not args.replace_existing:
    parser.error('content/english/site.json is maintained in this repository. Use --replace-existing only for an intentional migration/refresh; a backup will be saved before replacement.')
def load(name):
    spec = importlib.util.spec_from_file_location(name, source / 'content' / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
articles = load('articles').ARTICLES
clinic = load('clinic')
priority = json.loads((source / 'content/search-priority.json').read_text())['ranking']
articles.sort(key=lambda a: priority.get(str(a['id']), {}).get('rank', 100000))
metadata = json.loads((source / 'content/article-metadata.json').read_text())
artwork = json.loads((source / 'assets/article-art/manifest.json').read_text())
routes = json.loads((source / 'routes.json').read_text())
assert len(articles) == len({a['id'] for a in articles}), 'Duplicate source article IDs'
assert len(routes) == len({route['path'] for route in routes}), 'Duplicate routes'

def remap_url(url):
    if url.startswith('/assets/'):
        return '/english/assets/' + url.removeprefix('/assets/')
    if url.startswith('/') and not url.startswith('//'):
        return '/en/booking?lang=en&source=eden-english-site' if url.rstrip('/') == '/book' else '/en' + url.rstrip('/')
    if url.startswith('https://app.edenclinic.hk/booking'):
        from urllib.parse import urlsplit, parse_qsl, urlencode
        params = dict(parse_qsl(urlsplit(url).query))
        params.update(lang='en', source='eden-english-site')
        return '/en/booking?' + urlencode(params)
    return url

def brochure(path):
    doc = BeautifulSoup((source / 'dist' / path.strip('/') / 'index.html').read_text(), 'html.parser')
    main = doc.select_one('main')
    for element in main.select('[href], [src]'):
        for attribute in ('href', 'src'):
            if element.has_attr(attribute):
                element[attribute] = remap_url(element[attribute])
    # Old sample language notices are no longer true when using the localized shared flow.
    for element in main.select('.booking-language-note'):
        element.decompose()
    return dict(html=main.decode_contents(), description=doc.select_one('meta[name="description"]')['content'])

out = ROOT / 'content/english'
out.mkdir(parents=True, exist_ok=True)
for article in articles:
    original = json.loads((source / 'sources' / f'post-{article["id"]}.json').read_text())
    article.update(metadata=metadata[str(article['id'])], artwork=artwork[article['slug']], sourceUrl=original['link'], sourceTitle=original['title']['rendered'], sourceSnapshot=original.get('source_snapshot', '2026-10-06 published-post inventory'))
# Keep translations here; runtime identity and contact facts come from shared/clinic-data.ts.
clinics = [{k: c[k] for k in ('id', 'area', 'address', 'hours')} for c in clinic.CLINICS]
for c in clinics:
    c['sourceAddress'] = {'central':'中環皇后大道中70號卡佛大廈23樓2310室','jordan':'九龍佐敦寶靈街6號佐敦中心7樓全層','tsuenwan':'荃灣富麗花園商場A座地下20號舖'}[c['id']]
    c['sourceHours'] = {'central':'週一至五 11:00-14:00, 15:30-19:30；週六日及公眾假期休息','jordan':'週一至五 11:00-14:00, 15:30-19:30；週六 11:00-14:00, 15:30-18:30；週日及公眾假期休息','tsuenwan':'週一、二、四至六 10:30-14:00，15:30-19:00；週三及週日 10:30-14:00，15:30-17:00；公眾假期休息'}[c['id']]
data = dict(importedFrom='EdenClinicStudio/website/english-preview', sourceEdition='2026-10-11', routes=routes, articles=articles, doctors=clinic.DOCTORS, clinics=clinics, services=clinic.SERVICES, pages={p: brochure(p) for p in ('/', '/about/', '/fees/', '/first-visit/')})
if snapshot_path.exists():
    backup_dir = ROOT / 'output/english-import-backups'
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup = backup_dir / ('site-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.json')
    shutil.copy2(snapshot_path, backup)
    print(f'Backed up maintained English content to {backup.relative_to(ROOT)}')
snapshot_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
asset_dest = ROOT / 'public/english/assets'
asset_dest.mkdir(parents=True, exist_ok=True)
for file in (source / 'assets').rglob('*'):
    if file.is_file() and file.suffix.lower() in ('.png', '.webp', '.jpeg', '.jpg', '.svg', '.ttf'):
        dest = asset_dest / file.relative_to(source / 'assets')
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file, dest)
fonts = (source / 'assets/fonts.css').read_text().replace('/assets/', '/english/assets/').replace("'DM Sans'", "'Eden English Sans'").replace("'Cormorant Garamond'", "'Eden English Serif'")
(ROOT / 'app/en/fonts.css').write_text(fonts)
# Use the existing CSS parser to scope every rule, including media/print rules.
css_script = r'''
import fs from 'node:fs';
import postcss from 'postcss';
const css = postcss.parse(fs.readFileSync(process.argv[1], 'utf8'));
css.walkRules(rule => {
 if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
 rule.selectors = rule.selectors.map(selector => {
   if (/^(:root|html|body)(?=[\s.:#[]|$)/.test(selector)) return selector.replace(/^(:root|html|body)/, ':where(.eden-english)');
   return ':where(.eden-english) ' + selector;
 });
});
css.walkAtRules('keyframes', rule => { if (rule.params === 'unfold') rule.params = 'eden-english-unfold'; });
css.walkDecls('animation', decl => { decl.value = decl.value.replace(/\bunfold\b/g, 'eden-english-unfold'); });
// Tailwind declares components before utilities: shared booking utility classes must win.
fs.writeFileSync(process.argv[2], '@layer components {\n' + css.toString().replaceAll("'DM Sans'", "'Eden English Sans'") + '\n}\n');
'''
subprocess.run(['node', '--input-type=module', '-e', css_script, str(source / 'style.css'), str(ROOT / 'app/en/site.css')], check=True, cwd=ROOT)
print(f'Imported {len(routes)} routes, {len(articles)} articles; copied public artwork/fonts only.')
