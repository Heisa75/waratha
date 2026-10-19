// Reports the ways an option can give its own answer away, so the question
// bank can be checked without playing it.
//
//   node tools/option-balance.mjs            summary
//   node tools/option-balance.mjs --list     every question that leaks
//
// "Longest" is the one that matters: if picking the longest option beats 25%
// by much, a player can score without knowing anything.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const key = 'window.WARATHA_QUESTIONS = ';
const start = html.indexOf(key) + key.length;
let depth = 0, end = start;
for (let i = start; i < html.length; i++) {
  if (html[i] === '[') depth++;
  else if (html[i] === ']' && --depth === 0) { end = i + 1; break; }
}
const QUESTIONS = JSON.parse(html.slice(start, end));

const list = process.argv.includes('--list');
const arabic = /[؀-ۿ]/;
const report = {};

for (const lang of ['ar', 'en']) {
  const leaks = { longest: [], muchLonger: [], onlyArabic: [] };
  for (const q of QUESTIONS) {
    const opts = q.opts.map(o => String(o[lang] ?? o.ar ?? ''));
    if (opts.length !== 4 || !(q.ans >= 0 && q.ans < 4)) continue;
    const len = opts.map(o => o.length);
    const others = len.filter((_, i) => i !== q.ans);
    if (len[q.ans] === Math.max(...len) && len.filter(l => l === Math.max(...len)).length === 1) leaks.longest.push(q.id);
    if (len[q.ans] >= 1.6 * Math.max(...others)) leaks.muchLonger.push(q.id);
    if (lang === 'en') {
      const has = opts.map(o => arabic.test(o));
      if (has[q.ans] && has.filter(Boolean).length === 1) leaks.onlyArabic.push(q.id);
    }
  }
  report[lang] = leaks;
}

const pct = n => (n / QUESTIONS.length * 100).toFixed(1) + '%';
console.log(`${QUESTIONS.length} questions — picking at random scores 25.0%\n`);
for (const lang of ['ar', 'en']) {
  const l = report[lang];
  console.log(lang === 'ar' ? 'Arabic options:' : 'English options:');
  console.log(`  answer is the single longest option : ${String(l.longest.length).padStart(3)}  ${pct(l.longest.length)}`);
  console.log(`  answer is >= 1.6x every distractor  : ${String(l.muchLonger.length).padStart(3)}  ${pct(l.muchLonger.length)}`);
  if (lang === 'en') console.log(`  answer is the only one with Arabic  : ${String(l.onlyArabic.length).padStart(3)}  ${pct(l.onlyArabic.length)}`);
  if (list) {
    if (l.muchLonger.length) console.log('    much longer: ' + l.muchLonger.join(', '));
    if (l.onlyArabic?.length) console.log('    only Arabic: ' + l.onlyArabic.join(', '));
  }
  console.log('');
}
const spread = QUESTIONS.reduce((a, q) => { a[q.ans] = (a[q.ans] || 0) + 1; return a; }, {});
console.log('answer position spread:', spread, `(even would be ~${Math.round(QUESTIONS.length / 4)} each)`);
