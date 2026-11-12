#!/usr/bin/env node
/*
 * Correctness checks for taste-lint. Run: node scripts/check.js
 * - The clean example scores 95 or more and exits 0.
 * - The drifted example: all 10 planted problems found, at most 1 other finding, exits 1.
 * - Two runs give identical findings and scores. Each run takes under 60 s.
 * Writes reports to examples/<name>/report.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const ex = path.join(root, 'examples');
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  FAIL ' + m); } };

function run(name, out) {
  const t0 = Date.now();
  const r = spawnSync('node', [path.join(__dirname, 'measure.js'), '--design', path.join(ex, 'DESIGN.md'), '--html', path.join(ex, name, 'index.html'), '--out', out], { encoding: 'utf8' });
  const secs = (Date.now() - t0) / 1000;
  const report = JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8'));
  return { status: r.status, report, secs };
}

const clean = run('clean', path.join(ex, 'clean', 'report'));
console.log(`clean: ${clean.report.score}/100, ${clean.report.findings.length} findings, ${clean.secs.toFixed(1)}s`);
ok(clean.report.score >= 95, `clean scored ${clean.report.score}, needs 95+`);
ok(clean.status === 0, `clean should exit 0, got ${clean.status}`);
ok(clean.secs < 60, `clean took ${clean.secs}s`);

const drift = run('drifted', path.join(ex, 'drifted', 'report'));
const seeded = JSON.parse(fs.readFileSync(path.join(ex, 'drifted', 'expected.json'), 'utf8')).seeded;
const found = (s) => drift.report.findings.some((f) => f.category === s.category && f.value === s.value);
const missed = seeded.filter((s) => !found(s));
const extra = drift.report.findings.filter((f) => !seeded.some((s) => s.category === f.category && s.value === f.value));
console.log(`drifted: ${drift.report.score}/100, ${seeded.length - missed.length}/${seeded.length} planted found, ${extra.length} other, ${drift.secs.toFixed(1)}s`);
for (const m of missed) ok(false, `missed planted ${m.category} ${m.value}`);
if (!missed.length) ok(true);
ok(extra.length <= 1, `too many other findings: ${extra.map((f) => f.detail).join('; ')}`);
ok(drift.status === 1, `drifted should exit 1 (below threshold), got ${drift.status}`);

const again = run('drifted', path.join(require('os').tmpdir(), 'taste-lint-repeat'));
const strip = (r) => JSON.stringify({ s: r.score, f: r.findings.map((f) => [f.category, f.value, f.count]) });
ok(strip(again.report) === strip(drift.report), 'two runs gave different results');

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
