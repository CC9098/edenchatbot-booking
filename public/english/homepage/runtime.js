/* Generated from live WordPress homepage 35890; see scripts/import-english-homepage.py. */
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


(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var list = function (el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); };
  var isTM = function (stage) { return stage.dataset.method === 'timemap'; };

  function span(stage) {
    if (isTM(stage)) return [parseFloat(stage.dataset.start), parseFloat(stage.dataset.end)];
    var svg = stage.querySelector('[data-ink-svg]');
    return [parseFloat(svg.dataset.start), parseFloat(svg.dataset.end)];
  }

  function rate(stage, opts) {
    opts = opts || {};
    var dur = opts.duration || parseFloat(stage.dataset.duration);
    if (dur > 0) { var s = span(stage); return (s[1] - s[0]) / dur; }
    return opts.speed || parseFloat(stage.dataset.speed) || 1;
  }

  function stop(stage) {
    (stage._inkAnims || []).forEach(function (a) { a.cancel(); });
    (stage._inkTimers || []).forEach(clearTimeout);
    if (stage._inkRaf) cancelAnimationFrame(stage._inkRaf);
    stage._inkAnims = []; stage._inkTimers = []; stage._inkRaf = 0;
  }

  function done(stage, silent) {
    stage.classList.remove('is-playing');
    stage.classList.add('is-done');
    if (silent) return;
    stage.dispatchEvent(new CustomEvent('ink:done'));
    var hold = parseFloat(stage.dataset.hold) || 0;
    if (stage.dataset.loop === 'true') stage._inkTimers.push(setTimeout(function () { play(stage); }, hold * 1000 + 400));
  }

  function loadImage(src) {
    return new Promise(function (ok, fail) {
      var im = new Image();
      im.onload = function () { ok(im); };
      im.onerror = fail;
      im.src = src;
    });
  }

  function pixels(im, w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0);
    return x.getImageData(0, 0, w, h).data;
  }

  function tmData(stage) {
    if (stage._tm) return stage._tm.catch(() => null);
    var cv = stage.querySelector('.ink-tm-canvas');
    var w = cv.width, h = cv.height;
    var box = (window.InkRevealData || {})[stage.dataset.key] || {};
    stage._tm = Promise.all([loadImage(box.timemap || stage.dataset.timemap), loadImage(box.ink || stage.dataset.ink)]).then(function (ims) {
      var map = pixels(ims[0], w, h), ink = pixels(ims[1], w, h);
      var tmax = parseFloat(stage.dataset.tmax), idx = [], T = [], res = [];
      for (var i = 0, p = 0; p < w * h; p++, i += 4) {
        if (map[i + 2] === 0) continue;
        idx.push(i);
        T.push((map[i] * 256 + map[i + 1]) / 65535 * tmax);
        res.push(map[i + 2] < 200 ? 1 : 0);
      }
      var ctx = cv.getContext('2d');
      var out = ctx.createImageData(w, h);
      for (var k = 0; k < idx.length; k++) {
        var j = idx[k];
        out.data[j] = ink[j]; out.data[j + 1] = ink[j + 1]; out.data[j + 2] = ink[j + 2];
      }
      var pos = {};
      for (var q = 0; q < idx.length; q++) pos[idx[q] / 4] = q;
      var preT = new Float32Array(idx.length).fill(1e9), preC = new Float32Array(idx.length);
      (box.pre || []).forEach(function (e) { var q = pos[e[0]]; if (q !== undefined) { preT[q] = e[1]; preC[q] = e[2] / 255; } });
      return { ctx: ctx, out: out, ink: ink, idx: idx, T: new Float32Array(T), res: res, preT: preT, preC: preC };
    });
    return stage._tm.catch(() => null);
  }

  function tmRender(stage, d, t) {
    var soft = parseFloat(stage.dataset.soft) || 0.035;
    var fade = parseFloat(stage.dataset.residualFade) || 0.6;
    var o = d.out.data, ink = d.ink, idx = d.idx, T = d.T, res = d.res;
    for (var k = 0; k < idx.length; k++) {
      var f = res[k] ? (t - T[k] + fade) / fade : (t - T[k]) / soft;
      f = f <= 0 ? 0 : f >= 1 ? 1 : f;
      if (f < 1 && t > d.preT[k]) {
        var g = (t - d.preT[k]) / soft;
        g = (g >= 1 ? 1 : g) * d.preC[k];
        if (g > f) f = g;
      }
      o[idx[k] + 3] = ink[idx[k] + 3] * f;
    }
    d.ctx.putImageData(d.out, 0, 0);
  }

  function tmPlay(stage, k) {
    stage.classList.remove('is-done');
    stage.classList.add('is-playing');
    var strokes = JSON.parse(stage.dataset.strokes || '[]');
    var end = parseFloat(stage.dataset.end);
    tmData(stage).then(function (d) {
      if (!d) return finish(stage);
      if (!stage.classList.contains('is-playing')) return;
      tmRender(stage, d, -1);
      var t0 = performance.now();
      strokes.forEach(function (s) {
        stage._inkTimers.push(setTimeout(function () {
          stage.dispatchEvent(new CustomEvent('ink:strokestart', { detail: { n: s.n, name: s.name } }));
        }, s.start * 1000 / k));
      });
      var tick = function (now) {
        var t = (now - t0) / 1000 * k;
        tmRender(stage, d, t);
        if (t >= end + 0.1) { stage._inkRaf = 0; return finish(stage); }
        stage._inkRaf = requestAnimationFrame(tick);
      };
      stage._inkRaf = requestAnimationFrame(tick);
    });
  }

  function parts(stage) {
    var svg = stage.querySelector('[data-ink-svg]');
    return { svg: svg, pens: list(svg, '.ink-pen'), images: list(svg, '.ink-stroke'), residual: svg.querySelector('.ink-residual') };
  }

  function dashPlay(stage, k) {
    var p = parts(stage);
    stage.classList.remove('is-done');
    stage.classList.add('is-playing');
    var end = 0;
    p.pens.forEach(function (pen, i) {
      var img = p.images[i];
      img.setAttribute('mask', 'url(#' + pen.parentNode.id + ')');
      pen.style.strokeDashoffset = '1.05';
      var delay = parseFloat(pen.dataset.delay) * 1000 / k;
      var dur = parseFloat(pen.dataset.dur) * 1000 / k;
      var ease = pen.dataset.ease;
      var kf = JSON.parse(pen.dataset.kf).map(function (f) {
        return { offset: f[0], strokeDashoffset: String(1 - f[1]), easing: ease };
      });
      kf[0].strokeDashoffset = '0.999';
      var anim = pen.animate(kf, { delay: delay, duration: dur, fill: 'forwards' });
      stage._inkAnims.push(anim);
      anim.onfinish = function () { img.removeAttribute('mask'); };  // lift: full original edge
      stage._inkTimers.push(setTimeout(function () {
        stage.dispatchEvent(new CustomEvent('ink:strokestart', { detail: { n: i + 1, name: img.dataset.name } }));
      }, delay));
      end = Math.max(end, delay + dur);
    });
    if (p.residual) {  // faint stray pixels of the source fade in with the last stroke
      var fade = parseFloat(p.svg.dataset.residualFade) * 1000 / k;
      p.residual.style.opacity = '0';
      stage._inkAnims.push(p.residual.animate([{ opacity: 0 }, { opacity: 1 }],
        { delay: Math.max(0, end - fade), duration: fade, fill: 'forwards' }));
    }
    stage._inkTimers.push(setTimeout(function () { finish(stage); }, end + 60));
  }

  function finish(stage, silent) {
    stop(stage);
    if (!isTM(stage)) {
      var p = parts(stage);
      p.images.forEach(function (img) { img.removeAttribute('mask'); });
      if (p.residual) p.residual.style.opacity = '1';
    }
    done(stage, silent);
  }

  function play(stage, opts) {
    if (stage._inkObserver) { stage._inkObserver.disconnect(); stage._inkObserver = null; }
    var k = rate(stage, opts);
    stop(stage);
    if (reduce) return finish(stage);
    if (isTM(stage)) {
      if (!stage.querySelector('.ink-tm-canvas').getContext) return finish(stage);
      return tmPlay(stage, k);
    }
    var p = parts(stage);
    if (!p.pens.length || !p.pens[0].animate) return finish(stage);
    dashPlay(stage, k);
  }

  function seek(stage, t) {
    stop(stage);
    stage.classList.remove('is-done');
    stage.classList.add('is-playing');
    if (isTM(stage)) return tmData(stage).then(function (d) { tmRender(stage, d, t); });
    dashPlay(stage, 1);
    stage._inkTimers.forEach(clearTimeout);
    stage._inkAnims.forEach(function (a) { a.pause(); a.currentTime = t * 1000; });
    return Promise.resolve();
  }

  function init(stage) {
    if (stage._inkInit) return;
    stage._inkInit = true;
    if (reduce) { finish(stage, true); return; }
    if (isTM(stage)) tmData(stage);  // start decoding early
    var btn = stage.querySelector('[data-ink-replay]');
    if (btn) listen(btn, 'click', function () { play(stage); });
    var mode = stage.dataset.autoplay || 'inview';
    var start = function () { if (!stage.classList.contains('is-done')) play(stage); };
    if (mode === 'none') return finish(stage, true);
    if (mode === 'inview' && 'IntersectionObserver' in window) {
      var io = observe(function (es) {
        if (es[0].isIntersecting) { io.disconnect(); start(); }
      }, { threshold: 0.35 });
      stage._inkObserver = io; io.observe(stage);
    } else start();
  }

  window.InkReveal = { play: play, finish: finish, seek: seek, init: init };
  function boot() { list(document, '[data-ink-reveal]').forEach(init); }
  if (document.readyState === 'loading') listen(document, 'DOMContentLoaded', boot); else boot();
})();



(() => {
'use strict';
const DATA = {"fetchedAt":"2026-10-27T23:34:07.000Z","doctors":[{"id":"chan","name":"Dr. Chan","group":"tcm","treatments":["acupuncture","manual_therapy","herbal_prescription","other"],"clinics":[{"id":"central","schedule":{"0":null,"1":[{"start":"11:00","end":"14:00"}],"2":null,"3":null,"4":[{"start":"11:00","end":"14:00"}],"5":null,"6":null}},{"id":"jordan","schedule":{"0":null,"1":[{"start":"15:30","end":"19:30"}],"2":null,"3":null,"4":[{"start":"15:30","end":"19:30"}],"5":null,"6":null}},{"id":"tsuenwan","schedule":{"0":null,"1":null,"2":[{"start":"10:30","end":"14:00"},{"start":"15:30","end":"19:00"}],"3":null,"4":null,"5":[{"start":"10:30","end":"14:00"},{"start":"15:30","end":"19:00"}],"6":[{"start":"10:30","end":"14:00"},{"start":"15:30","end":"19:00"}]}},{"id":"online","schedule":{"0":null,"1":[{"start":"11:00","end":"14:00"},{"start":"15:30","end":"19:30"}],"2":[{"start":"10:30","end":"14:00"},{"start":"15:30","end":"19:00"}],"3":null,"4":[{"start":"11:00","end":"14:00"},{"start":"15:30","end":"19:30"}],"5":[{"start":"10:30","end":"14:00"},{"start":"15:30","end":"19:00"}],"6":[{"start":"10:30","end":"14:00"},{"start":"15:30","end":"19:00"}]}}]},{"id":"lee","name":"Dr. Lee","group":"tcm","treatments":["acupuncture"],"clinics":[{"id":"central","schedule":{"0":null,"1":[{"start":"15:30","end":"19:30"}],"2":[{"start":"15:30","end":"19:30"}],"3":[{"start":"11:00","end":"14:00"},{"start":"15:30","end":"19:30"}],"4":null,"5":null,"6":null}},{"id":"jordan","schedule":{"0":null,"1":[{"start":"11:00","end":"14:00"}],"2":[{"start":"11:00","end":"14:00"}],"3":null,"4":null,"5":[{"start":"15:30","end":"19:30"}],"6":[{"start":"11:00","end":"14:00"},{"start":"15:30","end":"18:30"}]}},{"id":"tsuenwan","schedule":{"0":null,"1":null,"2":null,"3":null,"4":[{"start":"10:30","end":"14:00"},{"start":"15:30","end":"19:00"}],"5":null,"6":null}},{"id":"online","schedule":{"0":null,"1":[{"start":"11:00","end":"14:00"},{"start":"15:30","end":"19:30"}],"2":[{"start":"11:00","end":"14:00"},{"start":"15:30","end":"19:30"}],"3":[{"start":"11:00","end":"14:00"},{"start":"15:30","end":"19:30"}],"4":[{"start":"10:30","end":"14:00"},{"start":"15:30","end":"19:00"}],"5":[{"start":"15:30","end":"19:30"}],"6":[{"start":"11:00","end":"14:00"},{"start":"15:30","end":"18:30"}]}}]},{"id":"hon","name":"Dr. Hon","group":"tcm","treatments":["acupuncture","manual_therapy","herbal_prescription","other"],"clinics":[{"id":"central","schedule":{"0":null,"1":null,"2":null,"3":null,"4":[{"start":"15:30","end":"19:30"}],"5":[{"start":"15:30","end":"19:30"}],"6":null}},{"id":"jordan","schedule":{"0":null,"1":null,"2":null,"3":[{"start":"11:00","end":"14:00"},{"start":"15:30","end":"19:30"}],"4":null,"5":[{"start":"11:00","end":"14:00"}],"6":null}},{"id":"tsuenwan","schedule":{"0":[{"start":"10:30","end":"14:00"},{"start":"15:30","end":"19:00"}],"1":[{"start":"10:30","end":"14:00"},{"start":"15:30","end":"19:00"}],"2":null,"3":null,"4":null,"5":null,"6":null}},{"id":"online","schedule":{"0":[{"start":"10:30","end":"14:00"},{"start":"15:30","end":"19:00"}],"1":[{"start":"10:30","end":"14:00"},{"start":"15:30","end":"19:00"}],"2":null,"3":[{"start":"11:00","end":"14:00"},{"start":"15:30","end":"19:30"}],"4":[{"start":"15:30","end":"19:30"}],"5":[{"start":"11:00","end":"14:00"},{"start":"15:30","end":"19:30"}],"6":null}}]},{"id":"chau","name":"Dr. Chau","group":"tcm","treatments":["acupuncture","manual_therapy","herbal_prescription","other"],"clinics":[{"id":"central","schedule":{"0":null,"1":null,"2":[{"start":"11:00","end":"14:00"}],"3":null,"4":null,"5":[{"start":"11:00","end":"14:00"}],"6":null}},{"id":"jordan","schedule":{"0":null,"1":null,"2":[{"start":"15:30","end":"19:30"}],"3":null,"4":null,"5":null,"6":null}},{"id":"online","schedule":{"0":null,"1":null,"2":[{"start":"11:00","end":"14:00"},{"start":"15:30","end":"19:30"}],"3":null,"4":null,"5":[{"start":"11:00","end":"14:00"}],"6":null}}]},{"id":"cheung","name":"Dr. Cheung","group":"tcm","treatments":["acupuncture","manual_therapy","herbal_prescription","other"],"clinics":[{"id":"online","schedule":{"0":null,"1":null,"2":null,"3":[{"start":"21:30","end":"23:30"}],"4":[{"start":"21:30","end":"23:30"}],"5":null,"6":null}}]},{"id":"wong","name":"Dr. Samuel H. C. Wong","group":"support","treatments":["manual_therapy"],"clinics":[{"id":"jordan","schedule":{"0":null,"1":null,"2":null,"3":null,"4":[{"start":"11:00","end":"14:00"}],"5":null,"6":[{"start":"14:30","end":"16:30"}]}}]}],"notices":[{"doctor":null,"clinic":null,"start":"2026-10-29","end":"2026-10-29","allDay":true,"text":"29/10員工活動日，全線Closed"},{"doctor":null,"clinic":null,"start":"2026-11-26","end":"2026-11-26","allDay":true,"text":"26/11員工活動日，全線Closed"},{"doctor":null,"clinic":null,"start":"2026-12-25","end":"2026-12-26","allDay":true,"text":"公眾假期 block"}]};
const DOCTOR_NAMES = { chan:'Dr. Chan', lee:'Dr. Lee', hon:'Dr. Hon', chau:'Dr. Chau', cheung:'Dr. Cheung', wong:'Dr. Samuel H. C. Wong' };
const BOOKING = '/en/booking';
const BIO = {
  chan: { cred: ['Registered Chinese medicine practitioner', 'Bachelor of Chinese Medicine, CUHK'], col: '/en/practitioners/chan' },
  lee: { cred: ['Registered Chinese medicine practitioner', 'Master of Chinese Medicine, HKBU', 'Bachelor of Chinese Medicine, CUHK'], col: '/en/practitioners/lee' },
  hon: { cred: ['Registered Chinese medicine practitioner', 'Master of Chinese Medicine (Acupuncture), HKU', 'Bachelor of Chinese Medicine, HKU'], col: '/en/practitioners/hon' },
  chau: { cred: ['Registered Chinese medicine practitioner', 'Bachelor of Chinese Medicine, Guangzhou University of Chinese Medicine'], col: '/en/practitioners/chau' },
  cheungmy: { cred: ['Registered Chinese medicine practitioner', 'Bachelor of Chinese Medicine (Honours), CUHK'], col: 'https://www.edenclinic.hk/%e9%86%ab%e5%a4%a9%e5%9c%93%e4%b8%ad%e9%86%ab%e8%a8%ba%e6%89%80%e5%9c%98%e9%9a%8a%e4%b8%a8%e5%bc%b5%e6%95%8f%e8%a8%80%e4%b8%ad%e9%86%ab%e5%b8%ab%e5%b0%88%e6%ac%84/' },
  cheung: { cred: ['Registered Chinese medicine practitioner', 'Master of Science in Chinese Medicine, CUHK', 'Bachelor of Chinese Medicine, CUHK'], col: '/en/practitioners/cheung' },
  wong: { cred: ['Collaborating registered chiropractor', 'Doctor of Chiropractic, USA'], col: '/en/practitioners/wong' },
};
const PORTRAITS = {"chan": "https://www.edenclinic.hk/wp-content/uploads/2026/10/eden-home-aeo-20261015-team-chan.webp", "lee": "https://www.edenclinic.hk/wp-content/uploads/2026/10/eden-home-aeo-20261015-team-lee.webp", "hon": "https://www.edenclinic.hk/wp-content/uploads/2026/10/eden-home-aeo-20261015-team-hon.webp", "chau": "https://www.edenclinic.hk/wp-content/uploads/2026/10/eden-home-aeo-20261015-team-chau.webp", "cheung": "https://www.edenclinic.hk/wp-content/uploads/2026/10/eden-home-aeo-20261015-team-cheung.webp", "cheungmy": "https://www.edenclinic.hk/wp-content/uploads/2026/10/eden-home-aeo-20261015-team-cheungmy.webp", "wong": "https://www.edenclinic.hk/wp-content/uploads/2026/10/eden-home-aeo-20261015-team-wong.webp"};
const portrait = (id) => PORTRAITS[id] || '';
const INK = {"chan": {"ch": "Harmony", "tmax": 7.75, "start": 0.35, "end": 6.75, "soft": 0.018, "w": 360, "h": 360}, "lee": {"ch": "Nurture", "tmax": 8.65, "start": 0.45, "end": 7.65, "soft": 0.02, "w": 329, "h": 360}, "hon": {"ch": "Gentleness", "tmax": 7.95, "start": 0.35, "end": 6.95, "soft": 0.018, "w": 319, "h": 360}, "chau": {"ch": "Flow", "tmax": 7.75, "start": 0.35, "end": 6.75, "soft": 0.018, "w": 360, "h": 360}, "cheungmy": {"ch": "Harmony", "tmax": 7.75, "start": 0.35, "end": 6.75, "soft": 0.018, "w": 360, "h": 310}, "wong": {"ch": "Alignment", "tmax": 7.75, "start": 0.35, "end": 6.75, "soft": 0.018, "w": 360, "h": 360}, "cheung": {"ch": "Observation", "tmax": 9.15, "start": 0.35, "end": 8.15, "soft": 0.018, "w": 360, "h": 360}, "leung": {"ch": "Connection", "tmax": 7.75, "start": 0.35, "end": 6.75, "soft": 0.018, "w": 360, "h": 360}};
const INKS = {"chan": ["/english/homepage/ink/eden-home-aeo-20261015-ink-chan-he-20261027.png", "/english/homepage/ink/eden-home-aeo-20261015-ink-chan-he-20261027-tm.png"], "lee": ["/english/homepage/ink/eden-home-aeo-20261015-ink-lee.png", "/english/homepage/ink/eden-home-aeo-20261015-ink-lee-tm.png"], "hon": ["/english/homepage/ink/eden-home-aeo-20261015-ink-hon.png", "/english/homepage/ink/eden-home-aeo-20261015-ink-hon-tm.png"], "chau": ["/english/homepage/ink/eden-home-aeo-20261015-ink-chau.png", "/english/homepage/ink/eden-home-aeo-20261015-ink-chau-tm.png"], "cheung": ["/english/homepage/ink/eden-home-aeo-20261015-ink-cheung.png", "/english/homepage/ink/eden-home-aeo-20261015-ink-cheung-tm.png"], "cheungmy": ["/english/homepage/ink/eden-home-aeo-20261015-ink-cheungmy.png", "/english/homepage/ink/eden-home-aeo-20261015-ink-cheungmy-tm.png"], "wong": ["/english/homepage/ink/eden-home-aeo-20261015-ink-wong.png", "/english/homepage/ink/eden-home-aeo-20261015-ink-wong-tm.png"]};
const InkReveal = window.InkReveal;
const inkSrc = (id, tm) => (INKS[id] || [])[tm ? 1 : 0] || '';
const VOICE = {
  leung: { name: 'Dr. Leung', role: 'Founder', say: 'The leaves of the tree are for the healing of the nations.', src: 'Revelation 22:2' },
  chan: { say: 'Follow nature. Make peace with your body.' },   // 2026-10-27 陳Practitioners提供
  lee: { say: 'Eating is more than a list of restrictions. It is a way to care for yourself every day.' },
  hon: { say: 'Before acupuncture, I explain each step so you can feel at ease.' },
  chau: { say: 'Pain can be the body’s way of reminding us to pause.' },
  cheungmy: { say: 'Come to me, all you who are weary and burdened, and I will give you rest.', src: 'Matthew 11:28' },
  cheung: { say: 'Even through a screen, I want to hear your whole story.' },
  wong: { say: 'Good posture is about finding a comfortable balance for your body.' },
};
const SOURCE = 'eden-english-homepage';
const DAYS = 14, SHOW = 4;
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ROOT = root;
const $ = (s, el = ROOT) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const P = {
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5 21 7.5v9l-5-3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  leaf: '<path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14z"/><path d="M5 19 13 11"/>',
  needle: '<path d="M4 20 14 10"/><path d="m13.5 7.5 3 3 4-4-3-3z"/>',
  hand: '<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-6.5a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0V12m0-2.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-5-2.7l-3.1-4.7a1.5 1.5 0 0 1 2.5-1.6L8 13.5"/>',
  spine: '<rect x="8" y="2.5" width="8" height="4.5" rx="1.8"/><rect x="8" y="9.75" width="8" height="4.5" rx="1.8"/><rect x="8" y="17" width="8" height="4.5" rx="1.8"/><path d="M4.5 4.75H8M16 4.75h3.5M4.5 12H8M16 12h3.5M4.5 19.25H8M16 19.25h3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M2.5 12h2M19.5 12h2M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  sunset: '<path d="M17 17a5 5 0 0 0-10 0"/><path d="M12 7.5v2.5M5.3 10.3l1.4 1.4M17.3 11.7l1.4-1.4M2.5 17h19M6 21h12"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  map: '<path d="M9 4 3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  chat: '<path d="M4.5 19.5 5.8 16A8 8 0 1 1 8.5 18.5z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M15 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14a6.5 6.5 0 0 1 4 6"/>',
  off: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M10 13.5l4 4M14 13.5l-4 4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};
const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

const CLINICS = [
  { id: 'central', name: 'Central', icon: 'pin', address: 'Room 2310, 23/F, Crawford House, 70 Queen’s Road Central', wa: '85259269537', map: 'https://maps.app.goo.gl/G3S73hfG6qk5o3cs8' },
  { id: 'jordan', name: 'Jordan', icon: 'pin', address: '7/F, Jordan Centre, 6 Bowring Street, Jordan', wa: '85259293042', map: 'https://maps.app.goo.gl/2pH44Tx6QQcWpn538' },
  { id: 'tsuenwan', name: 'Tsuen Wan', icon: 'pin', address: 'Shop 20, G/F, Block A, Fully Garden Shopping Centre, 24 Texaco Road', wa: '85251899065', map: 'https://maps.app.goo.gl/i18v8oYQAoG65XM66' },
  { id: 'online', name: 'Video', icon: 'video' },
];
const NEEDS = [
  { id: 'acupuncture', name: 'Acupuncture', icon: 'needle' },
  { id: 'manual_therapy', name: 'Manual care', icon: 'hand' },
  { id: 'herbal_prescription', name: 'Herbal medicine', icon: 'leaf' },
  { id: 'chiro', name: 'Chiropractor', icon: 'spine' },
];
const SESSIONS = [
  { id: 'am', name: 'Morning', icon: 'sun', start: 0, end: 720, hint: 'Before 12:00' },
  { id: 'pm', name: 'Afternoon', icon: 'sunset', start: 720, end: 1140, hint: '12:00–19:00' },
  { id: 'eve', name: 'Evening', icon: 'moon', start: 1140, end: 1440, hint: 'After 19:00' },
];
const state = { clinic: '', date: '', session: '', need: '', doctor: '', visit: 'first', open: '' };
const clinicById = (id) => CLINICS.find((c) => c.id === id);
const doctorById = (id) => DATA.doctors.find((d) => d.id === id);
const shortName = (d) => ({ chan:'Dr. Chan', lee:'Dr. Lee', hon:'Dr. Hon', chau:'Dr. Chau', cheung:'Dr. Cheung', wong:'Dr. Wong' }[d.id] || d.name);
const AVATARS = {"chan": "https://www.edenclinic.hk/wp-content/uploads/2026/10/eden-home-doctor-chan-20261008.webp", "lee": "https://www.edenclinic.hk/wp-content/uploads/2026/10/eden-home-doctor-lee-20261008.webp", "hon": "https://www.edenclinic.hk/wp-content/uploads/2026/10/eden-home-doctor-hon-20261008.webp", "chau": "https://www.edenclinic.hk/wp-content/uploads/2026/10/eden-home-doctor-chau-20261008.webp", "cheung": "https://www.edenclinic.hk/wp-content/uploads/2026/10/eden-home-doctor-cheung-20261008.webp", "cheungmy": "https://www.edenclinic.hk/wp-content/uploads/2026/10/eden-home-doctor-cheungmy-20261008.webp", "wong": "https://www.edenclinic.hk/wp-content/uploads/2026/10/eden-home-doctor-wong-20261008.webp"};
const avatar = (id) => AVATARS[id] || '';
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const hkNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
const hkToday = Date.UTC(hkNow.getFullYear(), hkNow.getMonth(), hkNow.getDate());
const nowMin = hkNow.getHours() * 60 + hkNow.getMinutes();
const dates = Array.from({ length: DAYS }, (_, i) => {
  const d = new Date(hkToday + i * 864e5);
  return { iso: d.toISOString().slice(0, 10), dow: d.getUTCDay(), m: d.getUTCMonth() + 1, day: d.getUTCDate(), i };
});
const dateById = (iso) => dates.find((d) => d.iso === iso);
const dayWord = (d) => (d.i === 0 ? 'Today' : d.i === 1 ? 'Tomorrow' : `${d.m}/${d.day} ${WEEK[d.dow]}`);

const noticesOn = (iso) => DATA.notices.filter((n) => n.allDay && n.start <= iso && iso <= n.end);
const closedFor = (doc, clinic, iso) => noticesOn(iso).some((n) => (!n.doctor || n.doctor === doc) && (!n.clinic || n.clinic === clinic));
const needOk = (doc, need) => !need || (need === 'chiro' ? doc.group === 'support' : doc.group !== 'support' && doc.treatments.includes(need));
const clinicOk = (need, clinic) => clinic !== 'online' || !['acupuncture', 'manual_therapy', 'chiro'].includes(need);
const SLOT_MIN = 15, SAME_DAY_BUFFER = 60, EVENING_CUTOFF = 19 * 60;
const LAST_START = { central: [795, 1125], jordan: [795, 1125], tsuenwan: [795, 1095] };
function clip(r, session, today, clinic) {
  const s = SESSIONS.find((x) => x.id === session);
  const r0 = toMin(r.start);
  let start = Math.max(r0, s ? s.start : 0, today ? nowMin + SAME_DAY_BUFFER : 0);
  start = r0 + Math.ceil((start - r0) / SLOT_MIN) * SLOT_MIN;
  const end = Math.min(toMin(r.end), s ? s.end : 1440);
  const cut = LAST_START[clinic];
  if (cut && start > (r0 < 14 * 60 ? cut[0] : cut[1])) return null;
  if (today && nowMin >= EVENING_CUTOFF && start >= EVENING_CUTOFF) return null;
  return start + SLOT_MIN <= end ? { start: toTime(start), end: toTime(end) } : null;
}

function slots(f) {
  const out = [];
  DATA.doctors.forEach((doc, order) => {
    if ((f.doctor && doc.id !== f.doctor) || !needOk(doc, f.need)) return;
    for (const c of doc.clinics) {
      if ((f.clinic && c.id !== f.clinic) || !clinicOk(f.need, c.id)) continue;
      for (const d of dates) {
        if (f.date && d.iso !== f.date) continue;
        if (closedFor(doc.id, c.id, d.iso)) continue;
        const ranges = (c.schedule[d.dow] || []).map((r) => clip(r, f.session, d.i === 0, c.id)).filter(Boolean);
        if (ranges.length) { out.push({ doc, c: clinicById(c.id), d, ranges, order }); break; }
      }
    }
  });
  return out.sort((a, b) => a.d.i - b.d.i || a.ranges[0].start.localeCompare(b.ranges[0].start) || (a.c.id === 'online') - (b.c.id === 'online') || a.order - b.order);
}
const anyFor = (k, v) => slots({ ...state, [k]: v }).length > 0;
function bookingUrl(doctor, clinic, iso) {
  const u = new URL(BOOKING, window.location.origin);
  u.searchParams.set('lang', 'en');
  if (doctor) u.searchParams.set('doctor', doctor);
  if (clinic) u.searchParams.set('clinic', clinic);
  if (iso) u.searchParams.set('date', iso);
  u.searchParams.set('source', SOURCE);
  return u.href;
}

function renderTiles() {
  const c = clinicById(state.clinic), d = dateById(state.date), s = SESSIONS.find((x) => x.id === state.session);
  const n = NEEDS.find((x) => x.id === state.need), doc = doctorById(state.doctor);
  const chev = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  const tile = (key, label, value, fallback) => {
    const b = $('#tile-' + key);
    b.classList.toggle('set', Boolean(value));
    b.setAttribute('aria-expanded', String(state.open === key));
    b.setAttribute('aria-label', `${label}：${value || fallback}，change selection`);
    b.innerHTML = `<span class="tx"><span class="k">${label}</span><span class="v">${esc(value || fallback)}</span></span>${chev}`;
  };
  tile('clinic', 'Clinic', c?.name, 'All clinics');
  tile('time', 'Date', [d && `${d.m}/${d.day}`, s?.name].filter(Boolean).join(' '), 'Any');
  tile('need', 'Treatment', n?.name, 'Any');
}

const joinTags = (ids) => {
  const places = ids.filter((id) => id !== 'online').map((id) => esc(clinicById(id).name)).join('・<wbr>');
  const video = ids.includes('online') ? `<span class="vtag"><svg class="vid" viewBox="0 0 24 24" aria-hidden="true">${P.video}</svg>Video</span>` : '';
  return places + video;
};
const clinicNames = (doc) => joinTags(doc.clinics.map((c) => c.id));  // 只喺「・」後斷行
function inkStage(id) {
  const k = INK[id];
  if (!k) return '';
  return `<div class="ink-reveal-stage" data-ink-reveal data-key="${id}" data-method="timemap" data-autoplay="immediate" data-duration="2.4" data-tmax="${k.tmax}" data-start="${k.start}" data-end="${k.end}" data-soft="${k.soft}" data-residual-fade=".6" data-ink="${inkSrc(id)}" data-timemap="${inkSrc(id, 1)}" style="--ink-aspect:${k.w}/${k.h}" role="img" aria-label="${k.ch}"><canvas class="ink-tm-canvas" width="${k.w}" height="${k.h}" aria-hidden="true"></canvas><img class="ink-tm-final" src="${inkSrc(id)}" width="${k.w}" height="${k.h}" alt=""></div>`;
}
function dayRanges(doc) {
  const d = dateById(state.date); if (!d) return null;
  const out = []; let had = false;
  doc.clinics.forEach((c) => {
    if ((state.clinic && c.id !== state.clinic) || !clinicOk(state.need, c.id) || closedFor(doc.id, c.id, d.iso)) return;
    (c.schedule[d.dow] || []).forEach((r) => {
      had = true;
      const cr = clip(r, state.session, d.i === 0, c.id);
      if (!cr) return;
      const label = state.clinic ? `${cr.start}–${cr.end}` : '#' + c.id;   // 未揀Clinic：只列當日喺邊間；揀咗Clinic先列（可約嘅）時間
      if (!out.includes(label)) out.push(label);
    });
  });
  return { out, had, today: d.i === 0 };
}
function teamNote() {
  const d = dateById(state.date), c = clinicById(state.clinic);
  if (!d && !c) return '';
  const n = DATA.doctors.filter((x) => anyFor('doctor', x.id)).length;
  const where = [d && `${d.m}/${d.day}`, c && c.name].filter(Boolean).join(' ');
  return `<p class="team-note">${esc(where)}：${n ? `${n} practitioners available. ${d && !c ? 'Choose a clinic to see times' : 'Select a practitioner to book'}` : 'No practitioners available. Try another date or clinic.'}</p>`;
}
function renderTeam() {
  $('#team').classList.toggle('has-sel', Boolean(state.doctor));
  const docLine = (d) => {
    const rr = dayRanges(d);
    if (!rr) return `<small>${d.group === 'support' ? 'Chiropractor・' : ''}${clinicNames(d)}</small>`;
    if (rr.out.length) return state.clinic ? `<small class="sess">${rr.out.map(esc).join('<br>')}</small>` : `<small class="sess wrap">${joinTags(rr.out.map((x) => x.slice(1)))}</small>`;
    return `<small class="off">${rr.had && rr.today ? 'Finished today' : 'Not consulting'}</small>`;
  };
  $('#team').innerHTML = teamNote() + DATA.doctors.map((d) => {
    const on = state.doctor === d.id;
    const fits = on || anyFor('doctor', d.id);   // 唔配合現有條件：照樣撳得，撳咗會自動放寬條件
    return `<button type="button" class="doc${fits ? '' : ' dim'}" data-key="doctor" data-value="${d.id}" aria-pressed="${on}" aria-label="${esc(d.name)}${fits ? '' : ' (no matching consultation; select to see other times)'}"><img src="${portrait(d.id)}" alt="" width="78" height="78"><b>${esc(shortName(d))}</b>${docLine(d)}</button>`;
  }).join('');
  const d = doctorById(state.doctor), pop = $('#docpop');
  if (!d) { pop.hidden = true; pop.innerHTML = ''; delete pop.dataset.ink; return; }
  const b = BIO[d.id] || { cred: [], col: '' };
  const mine = slots(state), first = mine[0];
  const others = mine.slice(1).filter((x, i, a) => a.findIndex((y) => y.c.id === x.c.id) === i && x.c.id !== first?.c.id);
  const when = first
    ? `<p class="next"><span>Earliest</span><b>${dayWord(first.d)} ${first.ranges.map((r) => `${r.start}–${r.end}`).join(' / ')}</b>・${first.c.name}${others.length ? `<br><span>Also</span>${others.map((x) => `<a href="${bookingUrl(d.id, x.c.id, x.d.iso)}" target="_blank" rel="noopener">${x.c.name}</a>`).join('・')}` : ''}</p>`
    : `<p class="next">No consultations match these filters in the next ${DAYS} days. <button type="button" class="chip clear" data-clear>Clear filters</button></p>`;
  pop.hidden = false;
  pop.innerHTML = `<img src="${portrait(d.id)}" alt="${esc(d.name)}" width="96" height="96">
    <div><h3>${esc(d.name)}</h3>
      <div class="sayrow">${VOICE[d.id] ? `<blockquote class="say${VOICE[d.id].say.length <= 14 ? ' short' : ''}">「${esc(VOICE[d.id].say)}」${VOICE[d.id].src ? `<small>— ${VOICE[d.id].src}</small>` : ''}</blockquote>` : ''}${inkStage(d.id)}</div>
      ${state.relaxed && state.relaxed.length ? `<p class="relax">${esc(shortName(d))} is unavailable for ${state.relaxed.map(esc).join(', ')}. Other consultation times are shown.</p>` : ''}
      ${when}
      <div class="acts">${first ? `<a class="b1" href="${bookingUrl(d.id, first.c.id, first.d.iso)}" target="_blank" rel="noopener">Book ${esc(shortName(d))}</a>` : ''}${b.col ? `<a class="lk" href="${b.col}" target="_blank" rel="noopener">Practitioner profile →</a>` : ''}</div>
      <p class="cred">${b.cred.map(esc).join('・')}</p></div>
    <button type="button" class="x" data-remove="doctor" aria-label="Deselect ${esc(d.name)}">✕</button>`;
  const stage = pop.querySelector('[data-ink-reveal]');
  if (stage && window.InkReveal) {
    if (pop.dataset.ink === d.id) { stage.classList.add('is-done'); } // 同一位Practitioners重畫：唔再寫一次
    else { pop.dataset.ink = d.id; InkReveal.init(stage); setTimeout(() => { if (!stage.classList.contains('is-done')) InkReveal.finish(stage); }, 5000); } // 圖載唔到就直接顯示完整字
    listen(stage, 'click', () => InkReveal.play(stage));
  }
}

const opt = (key, value, inner, enabled, extra = '') =>
  `<button type="button" class="opt" data-key="${key}" data-value="${esc(value)}" aria-pressed="${state[key] === value}" ${enabled || state[key] === value ? '' : 'disabled'}${extra}>${inner}</button>`;
const panels = {
  clinic: () => `<div class="grid">${opt('clinic', '', '<span>All clinics</span>', true)}${CLINICS.map((c) => opt('clinic', c.id, `${icon(c.icon)}<span>${c.name}</span>`, anyFor('clinic', c.id))).join('')}</div>`,
  time: () => `<div class="grid">${opt('session', '', '<span>All day<small>Any time</small></span>', true)}${SESSIONS.map((s) => opt('session', s.id, `${icon(s.icon)}<span>${s.name}<small>${s.hint}</small></span>`, anyFor('session', s.id))).join('')}</div>
    <div class="days">${opt('date', '', '<b>Any date</b>', true)}${dates.map((d) => opt('date', d.iso, `<b>${d.day}</b><small>${d.i === 0 ? 'Today' : d.day === 1 ? d.m + '/' : WEEK[d.dow]}</small>`, anyFor('date', d.iso), ` aria-label="${d.m}/${d.day} ${WEEK[d.dow]}"`)).join('')}</div>`,
  need: () => `<div class="grid">${opt('need', '', '<span>Any treatment</span>', true)}${NEEDS.map((n) => opt('need', n.id, `${icon(n.icon)}<span>${n.name}</span>`, anyFor('need', n.id))).join('')}</div>`,
  doctor: () => `<div class="docs">${DATA.doctors.map((d) => opt('doctor', d.id, `<img src="${avatar(d.id)}" alt=""><span>${esc(shortName(d))}</span>${d.group === 'support' ? '<em>Chiropractor</em>' : ''}`, anyFor('doctor', d.id), ` aria-label="${esc(d.name)}"`)).join('')}</div>`,
};
function renderPanel() {
  renderTiles();
  renderTeam();
  const p = $('#panel');
  if (!state.open) { p.hidden = true; p.innerHTML = ''; return; }
  p.hidden = false;
  p.setAttribute('aria-labelledby', 'tile-' + state.open);
  p.innerHTML = panels[state.open]();
}

const LABELS = {
  clinic: () => clinicById(state.clinic)?.name,
  date: () => { const d = dateById(state.date); return d && `${d.m}/${d.day}（${WEEK[d.dow]}）`; },
  session: () => SESSIONS.find((s) => s.id === state.session)?.name,
  need: () => NEEDS.find((n) => n.id === state.need)?.name,
};
function render() {
  $('#booking').hidden = Boolean(state.doctor); // 揀咗Practitioners：Earliest時段已喺簡介入面
  const keys = Object.keys(LABELS).filter((k) => state[k]);
  const chips = keys.map((k) => `<button type="button" class="chip" data-remove="${k}" aria-label="Remove ${esc(LABELS[k]())}">${esc(LABELS[k]())}${icon('x')}</button>`);
  if (chips.length > 1) chips.push(`<button type="button" class="chip clear" data-clear>Clear all</button>`);
  $('#chips').innerHTML = chips.join('');
  $('#res-title').textContent = keys.length || state.doctor ? 'Matching consultations' : 'Earliest consultations';

  const last = dates[DAYS - 1].iso;
  $('#banner').innerHTML = DATA.notices.filter((n) => !n.doctor && !n.clinic && n.end >= dates[0].iso && n.start <= last).slice(0, 1)
    .map((n) => { const d = dateById(n.start); return `<div class="banner">${icon('off')}${d ? `${d.m}/${d.day} ${WEEK[d.dow]}` : n.start} ${/public holiday|公眾假期/i.test(n.text) ? 'Public holiday: all clinics closed' : 'All clinics closed'}</div>`; }).join('');

  const c = clinicById(state.clinic);
  $('#cinfo').innerHTML = c && c.address
    ? `<div class="cinfo"><span class="addr">${c.name}・${esc(c.address)}</span><a href="${c.map}" target="_blank" rel="noopener">${icon('map')}Map</a><a href="https://wa.me/${c.wa}" target="_blank" rel="noopener">${icon('chat')}WhatsApp</a><a href="${bookingUrl('', c.id, state.date)}" target="_blank" rel="noopener">${icon('users')}Any practitioner</a></div>`
    : '';

  const list = slots(state);
  const rows = [];
  for (const x of list) {
    const r = rows.find((y) => y.doc.id === x.doc.id);
    if (r) r.alts.push(x); else rows.push({ ...x, alts: [] });
  }
  $('#slots').innerHTML = rows.length ? rows.slice(0, SHOW).map((s, i) => {
    const n = DATA.notices.find((x) => x.doctor === s.doc.id && x.end >= dates[0].iso && x.start <= last);
    const nd = n && dateById(n.start);
    return `<li class="slot${i === 0 ? ' first' : ''}">
      <img src="${avatar(s.doc.id)}" alt="" width="44" height="44">
      <div class="who"><b>${esc(shortName(s.doc))}</b><small>${s.doc.group === 'support' ? 'Chiropractor' : 'TCM practitioner'}・${s.c.name}</small>${i === 0 ? '<span class="tag">Earliest</span>' : ''}</div>
      <a class="go" href="${bookingUrl(s.doc.id, s.c.id, s.d.iso)}" target="_blank" rel="noopener" aria-label="Book ${esc(s.doc.name)}，${s.c.name}，${dayWord(s.d)}">Book </a>
      <div class="when"><strong>${dayWord(s.d)}</strong> ${s.ranges.map((r) => `${r.start}–${r.end}`).join(' / ')}</div>
      ${s.alts.length ? `<div class="alts">Also available: ${s.alts.map((a) => `<a href="${bookingUrl(a.doc.id, a.c.id, a.d.iso)}" target="_blank" rel="noopener">${a.c.name}</a>`).join('<span aria-hidden="true">・</span>')}</div>` : ''}
      ${nd ? `<div class="note">${nd.m}/${nd.day} Closed</div>` : ''}
    </li>`;
  }).join('') : `<li class="empty">No consultations match these filters in the next ${DAYS} days. <button type="button" class="chip clear" data-clear>Clear filters</button></li>`;

  $('#more').innerHTML = `<span>${rows.length > SHOW ? `${rows.length - SHOW} more practitioners` : ''}</span><a href="${bookingUrl(state.doctor, state.clinic, state.date)}" target="_blank" rel="noopener">View all times${icon('arrow')}</a>`;
  renderPanel();
}
function set(key, value) {
  state[key] = state[key] === value ? '' : value;
  if (key !== 'session') state.open = '';
  state.relaxed = [];
  render();
}
function pickDoctor(id) {
  if (state.doctor === id) { set('doctor', id); return; }
  const next = { ...state, doctor: id }, relaxed = [];
  for (const k of ['session', 'date', 'clinic', 'need']) {
    if (slots(next).length) break;
    if (next[k]) { relaxed.push(LABELS[k]()); next[k] = ''; }
  }
  Object.assign(state, next, { open: '', relaxed });
  render();
}

listen(document, 'click', (e) => {
  const t = e.target;
  if (!ROOT.contains(t)) { if (state.open) { state.open = ''; renderPanel(); } return; }
  const entry = t.closest('[data-entry]');
  if (entry) {
    state.open = state.open === entry.dataset.entry ? '' : entry.dataset.entry;
    renderPanel();
    if (state.open) $('#panel').scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
    return;
  }
  const dc = t.closest('.doc');
  if (dc) { pickDoctor(dc.dataset.value); return; }
  const o = t.closest('.opt');
  if (o) { set(o.dataset.key, o.dataset.value); return; }
  const rm = t.closest('[data-remove]');
  if (rm) { state[rm.dataset.remove] = ''; state.relaxed = []; render(); return; }
  if (t.closest('[data-clear]')) { Object.keys(LABELS).forEach((k) => { state[k] = ''; }); state.doctor = ''; state.open = ''; render(); return; }
  if (state.open && !t.closest('#panel')) { state.open = ''; renderPanel(); }
});
listen(document, 'keydown', (e) => { if (e.key === 'Escape' && state.open) { const k = state.open; state.open = ''; renderPanel(); $('#tile-' + k).focus(); } });
listen($('#q'), 'input', () => { $('#go-search').href = '/en/journal?q=' + encodeURIComponent($('#q').value.trim()); });
listen($('#search'), 'submit', (e) => { e.preventDefault(); $('#go-search').click(); });
render();

(() => {
  const SCHEDULE_API = 'https://app.edenclinic.hk/api/public/homepage-schedule';
  const HAS_PHOTO = new Set(DATA.doctors.map((d) => d.id));   // 只顯示有頭像相嘅Practitioners；新Practitioners要先加相
  if (!window.fetch) return;
  const ctrl = 'AbortController' in window ? requestController() : null;
  const timer = setTimeout(() => ctrl && ctrl.abort(), 6000);
  fetch(SCHEDULE_API, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined, credentials: 'omit' })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((d) => {
      clearTimeout(timer);
      if (!d || !Array.isArray(d.doctors) || !Array.isArray(d.notices)) return;
      const doctors = d.doctors.filter((x) => x && HAS_PHOTO.has(x.id) && Array.isArray(x.clinics) && Array.isArray(x.treatments));
      if (!doctors.length) return;
      DATA.doctors = doctors.map((doctor) => ({ ...doctor, name: DOCTOR_NAMES[doctor.id] || doctor.name }));
      DATA.notices = d.notices.filter((n) => n && n.start && n.end);
      DATA.fetchedAt = d.fetchedAt || DATA.fetchedAt;
      if (state.doctor && !doctorById(state.doctor)) state.doctor = '';
      render();
    })
    .catch(() => clearTimeout(timer));
})();

let motion = !REDUCED;
const hero = $('.hero');
const heroSlides = Array.from(hero.querySelectorAll('.slide'));
const HERO_LABELS = [
  { name: 'Central Clinic', addr: CLINICS[0].address },
  { name: 'Jordan Clinic', addr: CLINICS[1].address },
  { name: 'Tsuen Wan Clinic', addr: CLINICS[2].address },
];
let cur = 0, timer = null, hovered = false;
function schedule() {
  clearInterval(timer);
  if (motion && !hovered && !document.hidden && !hero.contains(document.activeElement)) timer = setInterval(() => show(cur + 1), 6500);
}
function show(i) {
  cur = (i + heroSlides.length) % heroSlides.length;
  heroSlides.forEach((s, j) => { s.classList.toggle('on', j === cur); s.setAttribute('aria-hidden', String(j !== cur)); });
  hero.classList.toggle('flip', cur === 2);
  $('#hero-name').textContent = HERO_LABELS[cur].name;
  $('#hero-addr').textContent = HERO_LABELS[cur].addr;
}
listen(hero, 'pointerenter', () => { hovered = true; schedule(); });
listen(hero, 'pointerleave', () => { hovered = false; schedule(); });
listen(hero, 'focusin', schedule);
listen(hero, 'focusout', () => setTimeout(schedule, 0));
listen(document, 'visibilitychange', schedule);

function setMotion(on) {
  motion = on;
  ROOT.classList.toggle('motion', on);
  schedule();
  if (window.__motionHook) window.__motionHook(on);
}
show(0);
if (!ROOT.dataset.layout) ROOT.dataset.layout = 'fuse';
setMotion(motion);

(() => {
  const groups = [
    ['.a2-belief', 0], ['.a2-h', 0], ['.a2-row', .08], ['.sec-head', 0],     ['.blog h2', 0], ['.topics li', .1], ['.latest li', .1],
  ];
  const els = [];
  groups.forEach(([sel, step]) => ROOT.querySelectorAll(sel).forEach((el, i) => {
    el.classList.add('reveal'); el.style.setProperty('--d', `${Math.min(i * step, .6)}s`); els.push(el);
  }));
  if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return; }
  const io = observe((list) => list.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: .12 });
  els.forEach((el) => io.observe(el));
  listen(window, 'beforeprint', () => els.forEach((el) => el.classList.add('in')));
})();

(() => {
  const FINE = matchMedia('(pointer: fine)').matches && innerWidth > 760;
  const hero = $('.hero'), heroCopy = $('.hero-copy'), slides = Array.from(ROOT.querySelectorAll('.hero .slide'));
  const leaves = $('.leaves'), branch = $('.branch'), scripture = $('.foot .scripture');
  const drift = FINE ? Array.from(ROOT.querySelectorAll('.sec-head h2, .aims h2, .blog h2, #eden-aeo[data-layout="fuse"] .belief')).map((el) => ({ el, s: el.classList.contains('belief') ? .1 : .06 })) : [];
  let lenis = null, ticking = false;
  const clamp = (v, a) => Math.max(-a, Math.min(a, v));
  function clear() {
    slides.forEach((el) => { el.style.translate = ''; });
    heroCopy.style.translate = ''; heroCopy.style.opacity = '';
    drift.forEach(({ el }) => { el.style.translate = ''; });
    leaves && leaves.style.removeProperty('--py'); branch && branch.style.removeProperty('--py'); scripture && scripture.style.removeProperty('--fy');
  }
  function frame() {
    ticking = false;
    if (!motion || !FINE) { clear(); return; }   // 手機：唔做層次移動，只保留淡入
    const vh = innerHeight;
    const hr = hero.getBoundingClientRect();
    if (hr.bottom > 0) {
      const off = Math.max(0, -hr.top);
      slides.forEach((el) => { el.style.translate = `0 ${Math.round(off * .32)}px`; });   // 相片：慢
      if (FINE) { heroCopy.style.translate = `0 ${Math.round(off * .55)}px`; heroCopy.style.opacity = String(Math.max(0, 1 - Math.pow(off / hr.height, 1.6))); } // 大字：快兼淡出
    }
    const lr = leaves && leaves.getBoundingClientRect();
    if (lr && lr.bottom > 0 && lr.top < vh) leaves.style.setProperty('--py', `${Math.round((lr.top + lr.height / 2 - vh / 2) * -.14)}px`);
    const br = branch && branch.getBoundingClientRect();
    if (br && br.bottom > 0 && br.top < vh) branch.style.setProperty('--py', `${Math.round((br.top + br.height / 2 - vh / 2) * -.18)}px`);
    if (scripture) { const sr = scripture.getBoundingClientRect(); if (sr.bottom > 0 && sr.top < vh) scripture.style.setProperty('--fy', `${Math.round((sr.top + sr.height / 2 - vh / 2) * -.22)}px`); }
    drift.forEach(({ el, s }) => { const r = el.getBoundingClientRect(); if (r.bottom < -50 || r.top > vh + 50) return; el.style.translate = `0 ${Math.round(clamp((r.top + r.height / 2 - vh / 2) * -s, 36))}px`; });
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  listen(window, 'scroll', onScroll, { passive: true });
  listen(window, 'resize', onScroll);
  function startSmooth() {
    if (lenis || !FINE || !window.Lenis) return;
    lenis = new Lenis({ lerp: .085, wheelMultiplier: .9, smoothWheel: true });  // 碌完自然減速：時快時慢
    const raf = (t) => { if (!lenis) return; lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  function stopSmooth() { if (lenis) { lenis.destroy(); lenis = null; } }
  listen(document, 'eden:modal', (e) => { if (lenis) e.detail ? lenis.stop() : lenis.start(); });
  listen(document, 'click', (e) => {
    const a = e.target.closest('a[href^="#"]'); if (!a || !lenis || !ROOT.contains(a)) return;
    const t = document.querySelector(a.getAttribute('href')); if (!t) return;
    e.preventDefault(); lenis.scrollTo(t, { offset: -72, duration: 1.4 });
  });
  window.__motionHook = (on) => { if (on) startSmooth(); else stopSmooth(); frame(); };
  cleanups.push(stopSmooth);
  if (motion) startSmooth();
  frame();
})();

const NEWS_API = '/api/public/latest-news';
const NEWS_PREVIEW = false;
const NEWS_SAMPLE = [];

(() => {
  const box = $('#news'), list = $('#news-list'), dlg = $('#newsbox');
  if (!box || !dlg) return;
  let items = [], cur = 0;
  const ctrl = 'AbortController' in window ? requestController() : null;
  const timer = setTimeout(() => ctrl && ctrl.abort(), 6000);
  (window.fetch ? fetch(NEWS_API, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined, credentials: 'omit' }) : Promise.reject(0))
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((d) => (Array.isArray(d.items) ? d.items.filter((item) => item.language === 'en' || item.locale === 'en' || item.locale === 'en-HK') : Promise.reject(0)))
    .catch(() => (NEWS_PREVIEW ? NEWS_SAMPLE : []))
    .then((all) => { clearTimeout(timer); show(all); });

  function show(all) {
    items = (all || []).slice().sort((x, y) => (y.pin ? 1 : 0) - (x.pin ? 1 : 0)).slice(0, 3);   // 最多三則
    if (!items.length) return;
    dlg.dataset.count = items.length;
    list.style.setProperty('--n', items.length);
    list.innerHTML = items.map((n, i) => `<li${n.pin ? ' class="pin"' : ''}><button type="button" data-i="${i}" aria-haspopup="dialog" aria-controls="newsbox">${n.thumb || n.img ? `<img class="news-th" src="${esc(n.thumb || n.img)}" alt="" width="36" height="48">` : ''}<span class="news-t">${esc(n.title).replace(/・/g, '・<wbr>')}</span><svg class="news-go" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button></li>`).join('');
    $('.nb-thumbs', dlg).innerHTML = items.map((n, i) => `<button type="button" data-i="${i}" aria-label="${esc(n.title)}"><img src="${esc(n.thumb || n.img)}" alt=""></button>`).join('');
    box.hidden = false;
  }
  function view(i) {
    cur = (i + items.length) % items.length;
    const n = items[cur], img = $('.nb-fig img', dlg);
    img.src = n.img || n.thumb; img.alt = n.title;
    $('.nb-fig figcaption', dlg).textContent = n.title;
    const ig = $('.nb-ig', dlg); if (n.link) { ig.href = n.link; ig.hidden = false; } else ig.hidden = true;
    $('.nb-n', dlg).textContent = items.length > 1 ? `${cur + 1} / ${items.length}` : '';
    dlg.querySelectorAll('.nb-thumbs button').forEach((b, k) => b.setAttribute('aria-current', String(k === cur)));
  }
  const lock = (on) => document.dispatchEvent(new CustomEvent('eden:modal', { detail: on }));
  listen(list, 'click', (e) => {
    const b = e.target.closest('button[data-i]'); if (!b) return;
    view(+b.dataset.i);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    lock(true);
  });
  listen(dlg, 'close', () => lock(false));
  listen(dlg, 'click', (e) => {
    if (e.target === dlg || e.target.closest('.nb-x')) return dlg.close ? dlg.close() : dlg.removeAttribute('open');
    if (e.target.closest('.nb-prev')) return view(cur - 1);
    if (e.target.closest('.nb-next')) return view(cur + 1);
    const t = e.target.closest('.nb-thumbs button'); if (t) view(+t.dataset.i);
  });
  listen(dlg, 'keydown', (e) => { if (e.key === 'ArrowLeft') view(cur - 1); if (e.key === 'ArrowRight') view(cur + 1); });
  let x0 = null;
  listen(dlg, 'touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  listen(dlg, 'touchend', (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 45) view(cur + (dx < 0 ? 1 : -1)); });
})();

ROOT.querySelectorAll('.foot .hrs-t').forEach((b) => listen(b, 'click', () => {
  const box = document.getElementById(b.getAttribute('aria-controls')), on = b.getAttribute('aria-expanded') !== 'true';
  b.setAttribute('aria-expanded', String(on)); box.classList.toggle('open', on);
}));

(() => {
  const book = document.getElementById('book'); if (!book || !('IntersectionObserver' in window)) return;
  observe((es) => es.forEach((e) => document.body.classList.toggle('eden-hide-fab', e.isIntersecting)), { rootMargin: '-15% 0px -15% 0px' }).observe(book);
})();

(() => {
  const root = document.querySelector('.em-logo'); if (!root) return;
  const T = { arc: [0, 1.6], stem: [1.75, 1.95], lobe: [1.9, 2.2], heng: [2.0, 2.55], pie: [2.7, 2.95], na: [3.05, 3.7] };   // 逐筆寫，筆與筆之間有停頓
  const SAFE = .25, SETTLE = 1.6, END = 4.2 + SETTLE;   // 寫完再用 1.6 秒沉到水印
  const wipes = Array.from(root.querySelectorAll('[data-wipe]')), fills = Array.from(root.querySelectorAll('[data-fill]'));
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // 起筆收筆慢
  const render = (t) => {
    wipes.forEach((el) => { const [a, b] = T[el.dataset.wipe]; el.setAttribute('stroke-dashoffset', String(1 - ease(clamp((t - a) / (b - a))))); });
    fills.forEach((el) => el.setAttribute('opacity', String(clamp((t - parseFloat(el.dataset.end)) / SAFE))));
    const k = clamp((t - 4.2) / SETTLE), rest = getComputedStyle(root).getPropertyValue('--em-rest') || .2;   // 4.2s 起沉落去
    if (k > 0 || t >= 99) root.style.opacity = String(parseFloat(getComputedStyle(root).getPropertyValue('--em-o')) * (1 - k) + parseFloat(rest) * k);
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { render(99); return; }
  render(0);
  let started = false, io = null;
  const start = () => {
    if (started) return; started = true;
    if (io) io.disconnect(); removeEventListener('scroll', onScroll);
    const t0 = performance.now();
    const tick = () => { const t = (performance.now() - t0) / 1000; render(t >= END ? 99 : t); return t < END; };
    const frame = () => { if (tick()) requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    const iv = setInterval(() => { if (!tick()) clearInterval(iv); }, 50);   // rAF 被節流（背景分頁）時用計時器頂住，保證寫完
  };
  const sec = root.closest('.leaves') || root;
  const inView = () => { const r = sec.getBoundingClientRect(); return r.bottom > innerHeight * .35 && r.top < innerHeight * .5; };   // 碌到宗旨段上半先寫，唔好一開頁就寫晒
  const onScroll = () => { if (inView()) start(); };
  if ('IntersectionObserver' in window) { io = observe((es) => { if (es.some((e) => e.isIntersecting)) start(); }, { threshold: .6 }); io.observe(sec); }
  listen(window, 'scroll', onScroll, { passive: true });
  const poll = setInterval(() => { if (started) clearInterval(poll); else onScroll(); }, 400);   // 第三重保險：IO／scroll 事件都唔郁（背景分頁）都會開始
  if (inView()) start();
})();





(() => {
  const sec = document.querySelector('.leaves.aims2'), mark = sec && sec.querySelector('.a2-mark'); if (!mark) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tick = false;
  const update = () => {
    tick = false;
    if (reduce || !motion) { mark.style.setProperty('--ink', '1'); mark.style.setProperty('--drift', '0px'); mark.style.setProperty('--rot', '-6deg'); return; }
    const r = sec.getBoundingClientRect(), vh = innerHeight;
    const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
    mark.style.setProperty('--ink', Math.min(1, Math.max(0, (p - .05) / .3)).toFixed(3));
    mark.style.setProperty('--drift', `${((p - .5) * (innerWidth <= 720 ? -30 : -90)).toFixed(1)}px`);
    mark.style.setProperty('--rot', `${(-6 + (p - .5) * -3).toFixed(2)}deg`);
  };
  const onScroll = () => { if (!tick) { tick = true; requestAnimationFrame(update); } };
  listen(window, 'scroll', onScroll, { passive: true });
  listen(window, 'resize', onScroll);
  const prevHook = window.__motionHook;
  window.__motionHook = (on) => { if (prevHook) prevHook(on); update(); };
  update();
})();
})();
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
