#!/usr/bin/env node
/*
 * taste-lint measure pass: compares what the browser actually renders with the tokens in DESIGN.md.
 *
 *   node scripts/measure.js --design DESIGN.md --url http://localhost:3000 --out taste-lint
 *   node scripts/measure.js --design DESIGN.md --html page.html --out taste-lint
 *
 * Options: --width 1280  --threshold 80 (exit 1 below)  --routes /,/pricing (with --url)
 * Writes report.json, report.html, report.png and evidence crops to the out folder.
 */
const fs = require('fs');
const path = require('path');
const { load } = require('./design-md.js');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.error('Playwright is needed: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };
const designPath = arg('design', 'DESIGN.md');
const url = arg('url');
const html = arg('html');
const outDir = arg('out', 'taste-lint');
const width = Number(arg('width', 1280));
const threshold = Number(arg('threshold', 80));
const routes = arg('routes', '/').split(',');

if (!url && !html) {
  console.error('Give a page: --url http://localhost:3000 or --html page.html');
  process.exit(2);
}

const tokens = load(designPath);
fs.mkdirSync(path.join(outDir, 'evidence'), { recursive: true });

// Category weights for the overall score. The measure pass is deterministic.
const WEIGHTS = { color: 25, type: 25, spacing: 20, radius: 10, contrast: 20 };
const PENALTY = 12; // points per distinct problem
const LABELS = { color: 'Colour', type: 'Type', spacing: 'Spacing', radius: 'Radius', contrast: 'Contrast' };

// ---------- colour maths ----------
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; }
function rgbToHex({ r, g, b }) { return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase(); }
function toLab({ r, g, b }) {
  const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const R = f(r), G = f(g), B = f(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const g2 = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return { L: 116 * g2(Y) - 16, a: 500 * (g2(X) - g2(Y)), b: 200 * (g2(Y) - g2(Z)) };
}
function chroma(h) { const l = toLab(hexToRgb(h)); return Math.hypot(l.a, l.b); }
function deltaE(h1, h2) { const a = toLab(hexToRgb(h1)), b = toLab(hexToRgb(h2)); return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b); }
function lum(h) { const { r, g, b } = hexToRgb(h); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
const nearest = (list, value, dist) => list.reduce((best, t) => { const d = dist(t, value); return !best || d < best.d ? { t, d } : best; }, null);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
  const findings = new Map(); // key -> finding
  let checked = 0;

  for (const route of routes) {
    const target = html ? 'file://' + path.resolve(html) : new URL(route, url).toString();
    await page.goto(target, { waitUntil: 'networkidle' }).catch(() => page.goto(target, { waitUntil: 'load' }));
    await page.waitForTimeout(300);

    const els = await page.evaluate(() => {
      const parse = (s) => { const m = s && s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
      const out = [];
      let id = 0;
      const solidBg = (el) => {
        for (let n = el; n; n = n.parentElement) {
          const c = parse(getComputedStyle(n).backgroundColor);
          if (c && c.a >= 1) return c;
        }
        return { r: 255, g: 255, b: 255, a: 1 };
      };
      for (const el of document.querySelectorAll('body, body *')) {
        if (['SCRIPT', 'STYLE', 'LINK', 'META', 'BR'].includes(el.tagName)) continue;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
        el.setAttribute('data-tl', String(++id));
        const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        const borderW = ['Top', 'Right', 'Bottom', 'Left'].map((s) => parseFloat(cs['border' + s + 'Width']));
        out.push({
          id, tag: el.tagName.toLowerCase(), cls: el.className && typeof el.className === 'string' ? el.className : '',
          text: hasText ? el.textContent.trim().slice(0, 40) : '',
          color: hasText ? parse(cs.color) : null,
          bg: parse(cs.backgroundColor),
          border: borderW.some((w) => w > 0) ? parse(cs.borderTopColor && borderW[0] > 0 ? cs.borderTopColor : cs.borderBottomColor) : null,
          solidBg: hasText ? solidBg(el) : null,
          family: hasText ? cs.fontFamily.split(',')[0].replace(/["']/g, '').trim() : null,
          size: hasText ? parseFloat(cs.fontSize) : null,
          weight: hasText ? Number(cs.fontWeight) : null,
          bold: Number(cs.fontWeight) >= 700,
          spacing: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft, cs.marginTop, cs.marginBottom, cs.rowGap, cs.columnGap]
            .map((v) => parseFloat(v)).filter((v) => v > 0 && !Number.isNaN(v)),
          radius: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius],
          box: { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height },
        });
      }
      return out;
    });

    const add = (category, value, el, detail, fix) => {
      const key = category + '|' + value;
      if (!findings.has(key)) findings.set(key, { category, value, detail, fix, count: 0, examples: [], route });
      const f = findings.get(key);
      f.count++;
      if (f.examples.length < 1) f.examples.push({ id: el.id, tag: el.tag, cls: el.cls, text: el.text, box: el.box });
    };
    const label = (el) => el.tag + (el.cls ? '.' + el.cls.split(' ')[0] : '');

    for (const el of els) {
      checked++;
      // Colour: every solid colour on the page must be within Delta E 2.3 of a token.
      for (const [kind, c] of [['text', el.color], ['background', el.bg], ['border', el.border]]) {
        if (!c || c.a < 1) continue;
        const hex = rgbToHex(c);
        const n = nearest(tokens.colors, hex, (t, v) => deltaE(t.hex, v));
        if (n && n.d > 2.3) {
          // Suggest like a designer would: a coloured value maps to a coloured token, a grey to a grey.
          const chromatic = tokens.colors.filter((t) => chroma(t.hex) > 15);
          const pool = chroma(hex) > 15 && chromatic.length ? chromatic : tokens.colors.filter((t) => chroma(t.hex) <= 15);
          const s = nearest(pool.length ? pool : tokens.colors, hex, (t, v) => deltaE(t.hex, v));
          add('color', hex, el, `Off-palette ${kind} colour ${hex} on ${label(el)}`, `Use ${s.t.name} (${s.t.hex})`);
        }
      }
      // Type: family, size and weight must come from the type scale.
      if (el.family) {
        if (tokens.families.length && !tokens.families.includes(el.family)) add('type', el.family, el, `Font ${el.family} on ${label(el)} isn't in DESIGN.md`, `Use ${tokens.families[0]}`);
        const s = nearest(tokens.sizes, el.size, (t, v) => Math.abs(t.size - v));
        if (s && s.d > 0.5) add('type', el.size + 'px', el, `Font size ${el.size}px on ${label(el)} isn't on the type scale`, `Use ${s.t.name} (${s.t.size}px)`);
        if (tokens.weights.length && !tokens.weights.includes(el.weight)) {
          const w = tokens.weights.reduce((a, b) => (Math.abs(b - el.weight) < Math.abs(a - el.weight) ? b : a));
          add('type', String(el.weight), el, `Font weight ${el.weight} on ${label(el)} isn't used in DESIGN.md`, `Use ${w}`);
        }
      }
      // Spacing: paddings, vertical margins and gaps must sit on the spacing scale.
      if (tokens.spacing.length) {
        for (const v of el.spacing) {
          const s = nearest(tokens.spacing, v, (t, x) => Math.abs(t.px - x));
          if (s.d > 0.5) add('spacing', Math.round(v * 10) / 10 + 'px', el, `Spacing ${Math.round(v * 10) / 10}px on ${label(el)} is off the scale`, `Use ${s.t.name} (${s.t.px}px)`);
        }
      }
      // Radius: every corner must be a rounded token (or a pill when a full token exists).
      if (tokens.rounded.length) {
        const hasFull = tokens.rounded.some((t) => t.px >= 999);
        for (const raw of new Set(el.radius)) {
          const v = parseFloat(raw);
          if (!v) continue;
          if (raw.includes('%') || v >= Math.min(el.box.w, el.box.h) / 2) { if (hasFull) continue; }
          const s = nearest(tokens.rounded, v, (t, x) => Math.abs(t.px - x));
          if (s.d > 0.5) add('radius', v + 'px', el, `Corner radius ${v}px on ${label(el)} isn't a rounded token`, `Use ${s.t.name} (${s.t.px}px)`);
        }
      }
      // Contrast: WCAG AA for text against its solid background.
      if (el.color && el.color.a >= 1 && el.solidBg) {
        const fg = rgbToHex(el.color), bg = rgbToHex(el.solidBg);
        const need = el.size >= 24 || (el.bold && el.size >= 18.66) ? 3 : 4.5;
        const cr = contrast(fg, bg);
        if (cr < need) {
          // Prefer the token made for this background (accent -> accent-ink, on-accent), then the closest passing token.
          const bgTok = tokens.colors.find((t) => deltaE(t.hex, bg) <= 2.3);
          const short = bgTok && bgTok.name.replace(/^colors\./, '');
          const paired = bgTok && tokens.colors.find((t) => [`colors.${short}-ink`, `colors.on-${short}`].includes(t.name) && contrast(t.hex, bg) >= need);
          const better = paired || tokens.colors.filter((t) => contrast(t.hex, bg) >= need).sort((a, b) => deltaE(a.hex, fg) - deltaE(b.hex, fg))[0];
          add('contrast', `${fg} on ${bg}`, el, `Text "${el.text.slice(0, 24)}" is ${cr.toFixed(2)}:1, needs ${need}:1`, better ? `Use ${better.name} (${better.hex}) on this background` : 'Change the background');
        }
      }
    }

    // Evidence crops for this route.
    for (const f of findings.values()) {
      const ex = f.examples[0];
      if (f.route !== route || f.crop || !ex) continue;
      const pad = 16;
      const clip = { x: Math.max(0, ex.box.x - pad), y: Math.max(0, ex.box.y - pad), width: Math.min(ex.box.w + pad * 2, 900), height: Math.min(ex.box.h + pad * 2, 360) };
      const file = `evidence/${[...findings.keys()].indexOf(f.category + '|' + f.value) + 1}.png`;
      await page.screenshot({ path: path.join(outDir, file), clip, fullPage: true }).catch(() => {});
      f.crop = file;
    }
  }

  // ---------- score ----------
  const list = [...findings.values()];
  const cats = {};
  for (const c of Object.keys(WEIGHTS)) {
    const n = list.filter((f) => f.category === c).length;
    cats[c] = { problems: n, score: Math.max(0, 100 - PENALTY * n) };
  }
  const total = Math.round(Object.entries(WEIGHTS).reduce((s, [c, w]) => s + cats[c].score * w, 0) / 100);
  const report = {
    design: tokens.name, page: html || url, routes, width, score: total, threshold, pass: total >= threshold,
    categories: cats, elementsChecked: checked,
    findings: list.map(({ category, value, detail, fix, count, crop, examples }) => ({ category, value, detail, fix, count, crop, where: examples[0] && examples[0].text })),
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');

  // ---------- report card ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const order = ['color', 'type', 'spacing', 'radius', 'contrast'];
  const card = `<!doctype html><html><head><meta charset="utf-8"><title>taste-lint report</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #ECEBE8; color: #111; font: 400 14px/1.45 Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  .wrap { width: 1200px; padding: 48px 56px 56px; }
  .mono { font-family: "JetBrains Mono", ui-monospace, Menlo, monospace; font-weight: 500; }
  .kicker { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #6B6A66; margin: 0 0 10px; }
  .top { display: grid; grid-template-columns: 300px 1fr; gap: 24px; margin-bottom: 24px; }
  .panel { background: #FAFAF9; border-radius: 20px; box-shadow: inset 0 1px 0 #fff, 0 0 0 1px #E2E0DB, 0 8px 24px rgba(40,36,30,.06); padding: 28px; }
  .score { font-size: 120px; line-height: .9; font-weight: 650; letter-spacing: -.05em; font-variant-numeric: tabular-nums; margin: 6px 0 14px; }
  .verdict { display: inline-block; font-size: 12px; padding: 6px 10px; border-radius: 999px; background: ${total >= threshold ? '#111' : '#D93036'}; color: #fff; }
  h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: -.02em; font-weight: 650; }
  .sub { color: #6B6A66; margin: 0 0 22px; }
  .bars { display: grid; gap: 14px; }
  .bar { display: grid; grid-template-columns: 90px 1fr 70px; align-items: center; gap: 14px; }
  .track { height: 10px; border-radius: 5px; background: #E6E4E0; overflow: hidden; }
  .fill { height: 100%; border-radius: 5px; background: #111; }
  .fill.low { background: #D93036; }
  .num { text-align: right; font-variant-numeric: tabular-nums; color: #6B6A66; font-size: 12px; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .f { background: #FAFAF9; border-radius: 16px; box-shadow: 0 0 0 1px #E2E0DB; overflow: hidden; display: flex; flex-direction: column; }
  .crop { background: #fff; height: 132px; display: grid; place-items: center; overflow: hidden; border-bottom: 1px solid #E8E6E1; }
  .crop img { max-width: 100%; max-height: 132px; object-fit: contain; }
  .fb { padding: 14px 16px 16px; }
  .tag { font-size: 11px; color: #D93036; letter-spacing: .06em; text-transform: uppercase; }
  .fb p { margin: 4px 0 6px; font-weight: 550; }
  .fix { color: #6B6A66; font-size: 13px; }
  .fix::before { content: '→ '; }
  .clean { padding: 40px; text-align: center; color: #6B6A66; }
</style></head><body><div class="wrap">
  <div class="top">
    <div class="panel"><p class="kicker mono">taste-lint</p><div class="score">${total}</div><span class="verdict mono">${total >= threshold ? 'Pass' : 'Below ' + threshold}</span></div>
    <div class="panel"><h1>${esc(tokens.name)} · DESIGN.md check</h1><p class="sub">${list.length ? list.length + ' distinct problems across ' + checked + ' elements' : 'No problems across ' + checked + ' elements'} · ${width}px</p>
      <div class="bars">${order.map((c) => `<div class="bar"><span>${LABELS[c]}</span><div class="track"><div class="fill ${cats[c].score < 70 ? 'low' : ''}" style="width:${cats[c].score}%"></div></div><span class="num mono">${cats[c].score}${cats[c].problems ? ' · ' + cats[c].problems : ''}</span></div>`).join('')}</div>
    </div>
  </div>
  ${list.length ? `<div class="grid">${list.slice(0, 12).map((f) => `<div class="f"><div class="crop">${f.crop ? `<img src="${f.crop}">` : ''}</div><div class="fb"><span class="tag mono">${LABELS[f.category]} · ${esc(f.value)}</span><p>${esc(f.detail)}</p><span class="fix">${esc(f.fix)}</span></div></div>`).join('')}</div>` : '<div class="panel clean">Everything on this page matches DESIGN.md.</div>'}
</div></body></html>`;
  fs.writeFileSync(path.join(outDir, 'report.html'), card);
  const rp = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  await rp.goto('file://' + path.resolve(outDir, 'report.html'), { waitUntil: 'networkidle' }).catch(() => {});
  await rp.screenshot({ path: path.join(outDir, 'report.png'), fullPage: true });
  await browser.close();

  console.log(`taste-lint: ${total}/100 (${report.pass ? 'pass' : 'below ' + threshold}) · ${list.length} problems`);
  for (const f of list) console.log(`  [${f.category}] ${f.detail} → ${f.fix}`);
  console.log(`Report: ${path.join(outDir, 'report.html')}`);
  process.exit(report.pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
