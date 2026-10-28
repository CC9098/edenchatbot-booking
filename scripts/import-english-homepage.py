"""Rebuild /en from the live Chinese homepage captured on 2026-10-28.

Source: WordPress page 35890, decoded vc_raw_html/vc_raw_js. The original
layout, images, scoped styles and interactions are retained. This script owns
translation and the narrow React/English route adaptations. Run from repo root.
Requires BeautifulSoup4; source inputs contain only public page content.
"""
from pathlib import Path
from bs4 import BeautifulSoup
import json, re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'content/english/homepage-source'
COPY = {
'醫天圓首頁':'Eden Clinic home','主選單':'Main navigation','主頁':'Home','關於我們':'About us','醫天圓視像應診':'Video consultation','收費':'Fees','醫天圓中醫保健博客':'Eden health journal','預約應診':'Book a visit','醫天圓中醫診所':'Eden TCM Clinic',
'醫天圓理念及治療宗旨':'Our philosophy and treatment aims','醫天圓相信醫治並非偶然，一切在於天、地、人的連結，':'At Eden, we believe healing is no coincidence. It grows from the connection between heaven, earth and people.','要心存謙卑，在獨特的時刻，奇妙醫治就會臨到。':'With humility, we welcome the healing that comes in its own time.',
'治療宗旨':'Treatment aims','聆聽':'Listen','連結':'Connect','專注':'Focus','歸正':'Restore','不只用耳，全心明白，':'Listening with our whole heart,','是醫治之基礎。':'the foundation of healing.','天地人成就美好的醫治。':'Heaven, earth and people, connected in healing.','用最微的疼痛，':'The gentlest treatment,','處理最大的不適。':'for the greatest discomfort.','回到身體最美的塑形。':'Restoring the body’s natural balance.',
'最新消息':'Latest news','關閉':'Close','上一則':'Previous item','下一則':'Next item','到 Instagram 睇全文':'Read more on Instagram',
'網上預約':'Online booking','預約條件':'Appointment filters','醫師':'Practitioners','已有預約？更改或取消 →':'Already booked? Change or cancel →','唔肯定揀邊位？WhatsApp 查詢：':'Need help choosing? WhatsApp us:','最快應診':'Earliest consultations','已選條件':'Selected filters','按應診時間排列，實際可約時段喺下一步確認。':'Listed by consultation time. Available appointment slots are confirmed in the next step.',
'按主題瀏覽健康文章':'Browse health articles by topic','頭腦':'Mind & head','失眠・脫髮・暈眩・中風':'Sleep · Hair loss · Dizziness · Stroke','痛症':'Pain','肌肉扭傷・各類痛症・筋膜':'Strains · Pain · Fascia','腸胃':'Digestion','胃酸倒流・腸化生・胃潰瘍':'Reflux · Intestinal metaplasia · Stomach ulcers','婦科':'Women’s health','減肥豐胸・產前產後':'Weight · Breast health · Pregnancy & postpartum','最新文章':'Latest articles','搜尋健康文章':'Search health articles','搜尋健康文章，例如：失眠、濕疹、產後':'Search health articles: sleep, eczema, postpartum…','搜尋 →':'Search →','瀏覽全部文章 →':'Browse all articles →','追蹤醫天圓：':'Follow Eden:',
'醫天圓 Facebook':'Eden Clinic on Facebook','醫天圓 Instagram':'Eden Clinic on Instagram','營業時間':'Opening hours','星期一至五':'Monday–Friday','星期六、日':'Saturday & Sunday','星期六':'Saturday','星期日':'Sunday','星期三':'Wednesday','星期一、二、四至日':'Monday, Tuesday & Thursday–Sunday','休息':'Closed','© 2026 醫天圓中醫診所. 版權所有 不得轉載.':'© 2026 Eden TCM Clinic. All rights reserved.','隱私權政策':'Privacy policy','免責聲明':'Disclaimer',
'皇后大道中70號卡佛大廈23樓2310室':'Room 2310, 23/F, Crawford House, 70 Queen’s Road Central',
'寶靈街6號佐敦中心7樓全層':'7/F, Jordan Centre, 6 Bowring Street, Jordan',
'德士古道24號富麗花園商場A座地下20號舖':'Shop 20, G/F, Block A, Fully Garden Shopping Centre, 24 Texaco Road',
'香港中環皇后大道中70號':'70 Queen’s Road Central, Central','卡佛大廈23樓2310室':'Room 2310, 23/F, Crawford House','九龍佐敦寶靈街6號':'6 Bowring Street, Jordan, Kowloon','佐敦中心7樓全層':'7/F, Jordan Centre','新界荃灣德士古道24號':'24 Texaco Road, Tsuen Wan, New Territories','富麗花園商場A座地下20號舖':'Shop 20, G/F, Block A, Fully Garden Shopping Centre',
'醫天圓中環診所接待處':'Reception at Eden Clinic, Central','醫天圓佐敦診所候診處':'Waiting area at Eden Clinic, Jordan','醫天圓荃灣診所候診走廊，淺綠牆上有金色經文，旁邊有綠植與長櫈':'Waiting area at Eden Clinic, Tsuen Wan, with pale green walls, plants and benches','醫天圓 Eden TCM Clinic':'Eden TCM Clinic 醫天圓',
'中環診所':'Central Clinic','佐敦診所':'Jordan Clinic','荃灣診所':'Tsuen Wan Clinic','中環':'Central','佐敦':'Jordan','荃灣':'Tsuen Wan',
}
# Longest phrases first prevents partial translations of addresses and labels.
def translate(s):
    for zh,en in sorted(COPY.items(), key=lambda x:len(x[0]), reverse=True): s=s.replace(zh,en)
    s=s.replace('地址：開地圖',' address: open map').replace('地圖',' map').replace('致電 ','Call ').replace('電話 ','Telephone ')
    return s

soup=BeautifulSoup((SOURCE/'wordpress-homepage.html').read_text(),'html.parser')
css='\n'.join(el.get_text() for el in soup.find_all('style'))
for el in soup(['style','script']): el.decompose()
for el in soup.find_all(True):
    el.attrs.pop('data-aeo',None)
    for k in ['aria-label','aria-roledescription','placeholder','title','alt']:
        if k in el.attrs: el[k]=translate(el[k]).replace('輪播','carousel')
for text in list(soup.find_all(string=True)):
    if text.parent and text.parent.name not in ['style','script']:text.replace_with(translate(str(text)))
# English destinations match the equivalent Chinese navigation, without changing layout.
nav=soup.select_one('.top nav')
for a,href in zip(nav.select('a'),['/en','/en/about','/en/booking?lang=en&clinic=online&source=eden-english-homepage','/en/fees','/en/journal']): a['href']=href
lang=soup.new_tag('a',href='https://www.edenclinic.hk/');lang['lang']='zh-Hant';lang.string='中文';nav.append(lang)
soup.select_one('.top .logo')['href']='/en'
soup.select_one('.bh-manage')['href']='/en/manage-booking?lang=en'
book_link=soup.new_tag('a',href='/en/booking?lang=en&source=eden-english-homepage');book_link['class']='bh-direct';book_link.string='Book online →';soup.select_one('.bookhelp').insert(0,book_link)
for a,href in zip(soup.select('.topics a'),['/en/journal/topics/sleep-and-stress','/en/journal/topics/pain-and-movement','/en/journal?q=digestion','/en/journal/topics/womens-health']):a['href']=href
soup.select_one('.all')['href']='/en/journal'
soup.select_one('#search')['action']='/en/journal'
soup.select_one('#q')['name']='q'
soup.select_one('#go-search')['href']='/en/journal'
# Preserve latest-list layout and image proportions, source articles from the English catalogue.
catalogue=json.loads((ROOT/'content/english/site.json').read_text())
for li,article in zip(soup.select('.latest li'),catalogue['articles'][:3]):
    li.select_one('a')['href']='/en/journal/'+article['slug']
    li.select_one('a > span').string=article['title']
    date=(article.get('metadata',{}).get('published') or '')[:10]
    if date:
        import datetime
        try:label=datetime.date.fromisoformat(date).strftime('%d %b %Y').lstrip('0')
        except ValueError: label=''
    else:label=''
    li.select_one('time').string=label
    if date:li.select_one('time')['datetime']=date
    else:li.select_one('time')['hidden']=''
    li.select_one('img')['src']='/english/assets/article-art/'+article['artwork']['svg'].replace('.svg','.png')
# Privacy/disclaimer pages already exist in the imported English content.
for a in soup.select('.legal a'):
    if a.get_text(strip=True)=='Privacy policy':a['href']='/en/privacy-policy'
    elif a.get_text(strip=True)=='Disclaimer':a['href']='https://www.edenclinic.hk/%e5%85%8d%e8%b2%ac%e8%81%b2%e6%98%8e/'
html=soup.prettify()
# Keep source CSS exactly scoped; remove WordPress-only global host adjustments.
css=css[css.index('#eden-aeo{'):]
css='/* Ported from live WordPress homepage 35890, 2026-10-28. Rebuild: python3 scripts/import-english-homepage.py */\n'+css
css+='''\n/* Only the home route supplies its own live-site header and footer. */
.eden-english:has(#eden-aeo) > .header,
.eden-english:has(#eden-aeo) > footer,
.eden-english:has(#eden-aeo) > .skip { display:none; }
.eden-english:has(#eden-aeo) { width:100%; overflow-x:clip; background:#fff; }
#eden-aeo .top nav a { font-size:16px; padding-inline:8px; }
#eden-aeo .a2-h { letter-spacing:.08em!important; text-indent:0!important; font-size:30px!important; }
#eden-aeo #book { scroll-margin-top:90px; }
#eden-aeo .a2-k span { font-size:30px; letter-spacing:.02em; }
#eden-aeo .a2-k small { display:none; }
#eden-aeo .doc b { font-size:18px; }
#eden-aeo .bh-direct { display:inline-block; margin-right:20px; color:var(--brand); font-weight:500; }
#eden-aeo .ink-reveal-stage { cursor:pointer; }
#eden-aeo .hero-copy .name { letter-spacing:.015em; }
@media(max-width:700px) { #eden-aeo .hero-copy .name { font-size:clamp(40px,9vw,58px); } #eden-aeo .a2-k span { font-size:24px; } #eden-aeo .a2-h { font-size:24px!important; letter-spacing:.03em!important; } }
'''
(ROOT/'app/en/homepage.css').write_text(css)
# String.raw is intentionally multiline/readable, unlike an escaped JSON blob.
(ROOT/'content/english/homepage.ts').write_text('// Generated by scripts/import-english-homepage.py from live WordPress homepage 35890.\nexport const englishHomepageHtml = String.raw`'+html.replace('`','\\`').replace('${','\\${')+'`;\n')

raw=BeautifulSoup((SOURCE/'wordpress-runtime.html').read_text(),'html.parser')
js='\n'.join(el.get_text() for el in raw.find_all('script') if not el.get('src'))
# No untranslated WordPress latest-post/news response is inserted into the English page.
start=js.index('// ---------- 博客最新文章')
end=js.index('// ---------- 頁尾',start)
js=js[:start]+'// Latest articles are rendered from the English catalogue above.\n'+js[end:]
js=js.replace(".then((d) => (Array.isArray(d.items) ? d.items : Promise.reject(0)))", ".then((d) => (Array.isArray(d.items) ? d.items.filter((item) => item.language === 'en' || item.locale === 'en' || item.locale === 'en-HK') : Promise.reject(0)))")
# Translate known dynamic labels before any broad replacements.
DYNAMIC={
'註冊中醫師':'Registered Chinese medicine practitioner','香港中文大學中醫學學士':'Bachelor of Chinese Medicine, CUHK','香港浸會大學中醫學碩士':'Master of Chinese Medicine, HKBU','香港大學中醫學碩士（針灸）':'Master of Chinese Medicine (Acupuncture), HKU','香港大學中醫全科學士':'Bachelor of Chinese Medicine, HKU','廣州中醫藥大學中醫學學士':'Bachelor of Chinese Medicine, Guangzhou University of Chinese Medicine','香港中文大學中醫系榮譽學士':'Bachelor of Chinese Medicine (Honours), CUHK','香港中文大學中醫理學碩士':'Master of Science in Chinese Medicine, CUHK','合作註冊脊醫':'Collaborating registered chiropractor','美國脊骨神經科醫學博士':'Doctor of Chiropractic, USA',
'梁仲威醫師':'Dr. Leung','陳家富醫師':'Dr. Chan','李芊霖醫師':'Dr. Lee','韓曉恩醫師':'Dr. Hon','周德健醫師':'Dr. Chau','張天慧醫師':'Dr. Cheung','黃浩哲脊醫':'Dr. Samuel H. C. Wong','創辦人':'Founder',
'樹上的葉子乃為醫治萬民。':'The leaves of the tree are for the healing of the nations.','啟示錄 22:2':'Revelation 22:2','順應自然，與身體和好。':'Follow nature. Make peace with your body.','飲食不是一張戒口清單，而是每天好好照顧自己的方式。':'Eating is more than a list of restrictions. It is a way to care for yourself every day.','下針之前，我會先把每一步說清楚，讓你安心，才開始。':'Before acupuncture, I explain each step so you can feel at ease.','身體的痛，很多時是在提醒我們：是時候停一停了。':'Pain can be the body’s way of reminding us to pause.','凡勞苦擔重擔的人可以到我這裡來，我就使你們得安息。':'Come to me, all you who are weary and burdened, and I will give you rest.','馬太福音 11:28':'Matthew 11:28','隔着屏幕，我也想好好聽你把話說完。':'Even through a screen, I want to hear your whole story.','好的姿勢不是挺得筆直，而是讓身體找回舒服的平衡。':'Good posture is about finding a comfortable balance for your body.',
'全部分店':'All clinics','不限日期':'Any date','不限療法':'Any treatment','不限時段':'Any time','全日':'All day','不限':'Any','分店':'Clinic','日期':'Date','療法':'Treatment','針灸':'Acupuncture','手法':'Manual care','中藥':'Herbal medicine','脊醫':'Chiropractor','視像':'Video','上午':'Morning','下午':'Afternoon','晚上':'Evening','12:00 前':'Before 12:00','19:00 後':'After 19:00','今日已完':'Finished today','當日休息':'Not consulting','按此更改':'change selection','清除條件':'Clear filters','全部清除':'Clear all','符合條件':'Matching consultations','最快應診':'Earliest consultations','取消揀選':'Deselect ','取消 ':'Remove ','今日':'Today','明日':'Tomorrow','地圖':'Map','不指定醫師':'Any practitioner','查看全部時段':'View all times','亦可預約：':'Also available: ','亦可':'Also','最快':'Earliest','醫師專欄 →':'Practitioner profile →','休息':'Closed','預約':'Book ',
}
# Protect syntax-sensitive weekday handling and English names first.
js=js.replace("const WEEK = ['日', '一', '二', '三', '四', '五', '六'];", "const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];")
js=js.replace("const shortName = (d) => d.name.replace(/(醫師|脊醫)$/, '');", "const shortName = (d) => ({ chan:'Dr. Chan', lee:'Dr. Lee', hon:'Dr. Hon', chau:'Dr. Chau', cheung:'Dr. Cheung', wong:'Dr. Wong' }[d.id] || d.name);")
js=js.replace("const u = new URL(BOOKING);", "const u = new URL(BOOKING, window.location.origin);\n  u.searchParams.set('lang', 'en');")
js=js.replace("const BOOKING = 'https://app.edenclinic.hk/booking';", "const BOOKING = '/en/booking';")
js=js.replace("const SOURCE = 'homepage-aeo';", "const SOURCE = 'eden-english-homepage';")
# Keep the same canonical live schedule endpoint as the Chinese homepage.
js=js.replace("const NEWS_API = 'https://app.edenclinic.hk/api/public/latest-news';", "const NEWS_API = '/api/public/latest-news';")
# Localized names apply to both embedded fallback and refreshed live schedule.
js=js.replace('DATA.doctors = doctors;', 'DATA.doctors = doctors.map((doctor) => ({ ...doctor, name: DOCTOR_NAMES[doctor.id] || doctor.name }));')
js=js.replace("const BOOKING =", "const DOCTOR_NAMES = { chan:'Dr. Chan', lee:'Dr. Lee', hon:'Dr. Hon', chau:'Dr. Chau', cheung:'Dr. Cheung', wong:'Dr. Samuel H. C. Wong' };\nconst BOOKING =")
js=js.replace("'https://www.edenclinic.hk/?s='", "'/en/journal?q='")
js=js.replace('`${d.m}月${d.day}日 星期${WEEK[d.dow]}`','`${d.m}/${d.day} ${WEEK[d.dow]}`')
js=js.replace('${d.m}月${d.day}日 星期${WEEK[d.dow]}','${d.m}/${d.day} ${WEEK[d.dow]}')
js=js.replace("d.m + '月'", "d.m + '/'").replace("'今'", "'Today'").replace(' 星期${WEEK[d.dow]}',' ${WEEK[d.dow]}')
js=js.replace('呢組條件未來 ${DAYS} 日冇應診。','No consultations match these filters in the next ${DAYS} days. ')
js=js.replace('${n} 位醫師應診，','${n} practitioners available. ')
js=js.replace('揀分店睇時間','Choose a clinic to see times').replace('撳頭像預約','Select a practitioner to book').replace('冇醫師應診，試吓改日期或分店','No practitioners available. Try another date or clinic.')
js=js.replace('（現有條件冇應診，撳嚟睇其他時段）',' (no matching consultation; select to see other times)')
js=js.replace("${d.group === 'support' ? '脊醫' : '醫師'}喺「${state.relaxed.map(esc).join('・')}」冇應診，已改為顯示佢其他時段。", " is unavailable for ${state.relaxed.map(esc).join(', ')}. Other consultation times are shown.")
js=js.replace('仲有 ${rows.length - SHOW} 位醫師','${rows.length - SHOW} more practitioners')
js=js.replace("${d.group === 'support' ? '脊醫' : '醫師'}", "").replace("${s.doc.group === 'support' ? '脊醫' : '醫師'}", "${s.doc.group === 'support' ? 'Chiropractor' : 'TCM practitioner'}")
js=js.replace("/公眾假期/.test(n.text) ? '公眾假期，全線休診' : '全線休診'", "/public holiday|公眾假期/i.test(n.text) ? 'Public holiday: all clinics closed' : 'All clinics closed'")
for zh,en in sorted({**COPY,**DYNAMIC}.items(),key=lambda x:len(x[0]),reverse=True):js=js.replace(zh,en)
# Preserve the final ink image if a time-map request fails.
js=js.replace('stage._tm = Promise.all(', 'stage._tm = Promise.all(')
js=js.replace('return stage._tm;', 'return stage._tm.catch(() => null);')
js=js.replace("if (!stage.classList.contains('is-playing')) return;", "if (!d) return finish(stage);\n      if (!stage.classList.contains('is-playing')) return;")
# Canvas timemaps must be same-origin; WordPress media has no CORS header.
for url in set(re.findall(r'https://www\.edenclinic\.hk/wp-content/uploads/[^"\s]+\.png', js)):
    js=js.replace(url, '/english/homepage/ink/'+url.rsplit('/',1)[1])
for glyph, label in {'和':'Harmony','養':'Nurture','柔':'Gentleness','通':'Flow','正':'Alignment','察':'Observation','連':'Connection'}.items():
    js=js.replace('"ch": "'+glyph+'"', '"ch": "'+label+'"')
# Columns link to their English profiles, including the chiropractor.
for line in js.splitlines():
    if re.search(r'^  (chan|lee|hon|chau|cheung|wong): \{ cred:',line):
        id=re.search(r'^  (\w+):',line)[1]
        new=re.sub(r"col: '[^']*'", "col: '/en/practitioners/"+id+"'",line)
        js=js.replace(line,new)
# Remove source-only comments before emitting the runtime, retaining readable code.
js=re.sub(r'/\*.*?\*/','',js,flags=re.S)
js='\n'.join(line for line in js.splitlines() if not line.lstrip().startswith('//'))
# All effects belong to a single mounted home instance. Global handlers use the
# lifecycle signal; timers, frames, observers and fetches stop on unmount.
js=js.replace("const ROOT = document.getElementById('eden-aeo');", "const ROOT = root;")
js=js.replace("document.addEventListener(","listen(document, ")
for target in ['btn', 'stage', 'hero', 'list', 'dlg', 'b', "$('#q')", "$('#search')"]:
    js=js.replace(target+'.addEventListener(', 'listen('+target+', ')
js=re.sub(r'(?<![\w.])addEventListener\(', 'listen(window, ',js)
js=js.replace('new IntersectionObserver(', 'observe(')
js=js.replace('new AbortController()', 'requestController()')
js=js.replace("const stopSmooth()", "const stopSmooth()")
js=js.replace("if (motion) startSmooth();", "cleanups.push(stopSmooth);\n  if (motion) startSmooth();")
js=js.replace('const inkSrc =', 'const InkReveal = window.InkReveal;\nconst inkSrc =')
# News may contain images with Chinese text; English edition shows no item unless
# the synchronizer explicitly marks it English above.
pre='''/* Generated from live WordPress homepage 35890; see scripts/import-english-homepage.py. */
window.initializeEdenEnglishHomepage = function (root) {
  let disposed = false;
  const cleanups = [], intervals = new Set(), timeouts = new Set(), frames = new Set(), observers = new Set(), requests = new Set();
  const lifecycle = new AbortController();
  const previousInk = window.InkReveal, previousMotionHook = window.__motionHook;
  function listen(target, type, handler, options = {}) {
    target.addEventListener(type, handler, { ...(typeof options === 'boolean' ? { capture: options } : options), signal: lifecycle.signal });
  }
  function requestController() { const controller = new AbortController(); requests.add(controller); return controller; }
  function observe(callback, options) { const observer = new IntersectionObserver(callback, options); observers.add(observer); return observer; }
  function setInterval(callback, delay) { const id = window.setInterval(() => { if (!disposed) callback(); }, delay); intervals.add(id); return id; }
  function clearInterval(id) { window.clearInterval(id); intervals.delete(id); }
  function setTimeout(callback, delay) { const id = window.setTimeout(() => { timeouts.delete(id); if (!disposed) callback(); }, delay); timeouts.add(id); return id; }
  function clearTimeout(id) { window.clearTimeout(id); timeouts.delete(id); }
  function requestAnimationFrame(callback) { const id = window.requestAnimationFrame((time) => { frames.delete(id); if (!disposed) callback(time); }); frames.add(id); return id; }
  function cancelAnimationFrame(id) { window.cancelAnimationFrame(id); frames.delete(id); }
'''
post='''
  return () => {
    disposed = true;
    lifecycle.abort();
    intervals.forEach(window.clearInterval); timeouts.forEach(window.clearTimeout); frames.forEach(window.cancelAnimationFrame);
    observers.forEach((observer) => observer.disconnect()); requests.forEach((controller) => controller.abort());
    cleanups.forEach((cleanup) => cleanup());
    root.querySelectorAll('[data-ink-reveal]').forEach((stage) => { (stage._inkAnims || []).forEach((animation) => animation.cancel()); });
    document.body.classList.remove('eden-hide-fab');
    window.InkReveal = previousInk; window.__motionHook = previousMotionHook;
  };
};
'''
(ROOT/'public/english/homepage/runtime.js').write_text(pre+js+post)
print('Generated homepage markup, CSS and lifecycle-managed runtime.')
