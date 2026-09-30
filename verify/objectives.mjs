// Checks the quiz's topics and question bank against the owner's objectives
// doc (verify/objectives-cysa-2026-09-30.md, copied verbatim), then drives the
// pages in Chromium:
//   - CYSA_OBJECTIVES / CYSA_SUB_OBJECTIVES are the doc's domains and topics, in
//     its order, numbered 1.1, 1.2 ... per domain, in the doc's wording
//   - every question is filed under one of them, with that topic's domain
//   - every topic has at least 20 questions, except the ones in PENDING below
//     (still being written); a PENDING topic that has reached 20 fails too
//   - every question is well formed: 4 options, exactly one correct, text and a
//     "why" on every option, no wrong option sharing the right one's why; ids
//     and question texts unique
//   - the custom quiz page lists every topic that has questions, with its true
//     count, under its domain, and a quiz on one topic draws only that topic
//   - the newest questions play: answered right on the page, they're marked
//     right, score 100, and the results screen's score bars paint
//   - no script errors
//   node verify/objectives.mjs [dir]    dir defaults to the repo
//   node verify/objectives.mjs --plant  proves each check can fail
// Needs Playwright. Not needed to run the site. Exit 1 on any failure.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const PW = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const KEY = 'cysa_quiz_session_v1';
const MIN = 20;
// Topics still short of 20 while new questions are written for them (30 Sept 2026).
// Remove a topic from this list in the same commit that fills it.
const PENDING = [];

// ---- the doc: domains in order, each with its topics in order ----
const DOC = [];
for (const line of fs.readFileSync(path.join(HERE, 'objectives-cysa-2026-09-30.md'), 'utf8').split('\n')) {
  let m;
  if ((m = line.match(/^### \*\*(.+) \((\d+)%\)\*\*/))) DOC.push({ name: m[1], topics: [] });
  else if ((m = line.match(/^\s+- \*\*(.+?):\*\*/)) && DOC.length) DOC[DOC.length - 1].topics.push(m[1]);
}

function read(dir) {
  const ctx = { module: {} };
  vm.runInNewContext(fs.readFileSync(path.join(dir, 'assets', 'data.js'), 'utf8'), ctx);
  const { CYSA_QUESTIONS: B, CYSA_OBJECTIVES: D, CYSA_SUB_OBJECTIVES: S } = ctx.module.exports;
  return { B, D, S };
}
function write(dir, { B, D, S }) {
  fs.writeFileSync(path.join(dir, 'assets', 'data.js'), 'const CYSA_QUESTIONS = ' + JSON.stringify(B) + ';\nconst CYSA_OBJECTIVES = ' + JSON.stringify(D) +
    ';\nconst CYSA_SUB_OBJECTIVES = ' + JSON.stringify(S) + ';\nif (typeof module !== "undefined") module.exports = { CYSA_QUESTIONS, CYSA_OBJECTIVES, CYSA_SUB_OBJECTIVES };\n');
}

async function run(dir, pending = PENDING) {
  const fails = []; const ok = (c, m) => { if (!c) fails.push(m); };
  let B = [], D = {}, S = {};
  try { ({ B, D, S } = read(dir)); } catch (e) { fails.push('question bank does not parse: ' + e.message); }

  // domains and topics are the doc's, in order
  const doms = Object.keys(D);
  ok(doms.length === DOC.length, `${doms.length} domains, doc has ${DOC.length}`);
  DOC.forEach((d, i) => {
    const id = `${i + 1}.0`;
    ok(doms[i] === id && D[id] === d.name, `domain ${i + 1} is ${doms[i]} "${D[doms[i]]}", doc says ${id} "${d.name}"`);
    const subs = S[id] || [];
    ok(subs.length === d.topics.length, `${id}: ${subs.length} topics, doc has ${d.topics.length}`);
    d.topics.forEach((t, j) => ok(subs[j] && subs[j].id === `${i + 1}.${j + 1}` && subs[j].label === t, `${id} topic ${j + 1} is ${JSON.stringify(subs[j])}, doc says ${i + 1}.${j + 1} "${t}"`));
  });

  // every question filed and well formed; every topic >= MIN unless pending
  const topic = {}; for (const [d, subs] of Object.entries(S)) for (const s of subs) topic[s.id] = { ...s, domain: d };
  const ids = new Set(), texts = new Set(), count = {};
  for (const q of B) {
    ok(!ids.has(q.id), `duplicate question id ${q.id}`); ids.add(q.id);
    ok(!texts.has(q.q), `${q.id}: question text repeats another question word for word`); texts.add(q.q);
    const t = topic[q.sub];
    ok(t, `${q.id} is filed under "${q.sub}", which isn't a topic`);
    if (t) ok(q.objective === t.domain && q.objectiveName === D[t.domain], `${q.id} says domain ${q.objective} "${q.objectiveName}" but topic ${q.sub} is in ${t.domain} "${D[t.domain]}"`);
    const o = q.options || [];
    ok(o.length === 4 && o.every(x => typeof x.text === 'string' && x.text.trim() && typeof x.why === 'string' && x.why.trim()), `${q.id}: options malformed, or an option has no "why"`);
    ok(o.filter(x => x.correct === true).length === 1, `${q.id}: ${o.filter(x => x.correct === true).length} options marked correct`);
    const right = o.find(x => x.correct);
    if (right) o.forEach((x, i) => { if (!x.correct) ok(x.why.trim() !== right.why.trim(), `${q.id}: option ${i} carries the right answer's why, so the key or the whys are misaligned`); });
    count[q.sub] = (count[q.sub] || 0) + 1;
  }
  for (const id of Object.keys(topic)) {
    const n = count[id] || 0;
    if (pending.includes(id)) ok(n < MIN, `topic ${id} has ${n} questions but is still listed as PENDING — take it off the list`);
    else ok(n >= MIN, `topic ${id} has ${n} questions, fewer than ${MIN}`);
  }

  const srv = http.createServer((q, r) => { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(f, (e, b) => { r.writeHead(e ? 404 : 200, { 'content-type': TYPES[path.extname(f)] || 'text/plain' }); r.end(e ? '' : b); }); }).listen(0);
  const URL = `http://127.0.0.1:${srv.address().port}`;
  const pw = await import(PW); const { chromium } = pw.default || pw;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.setDefaultTimeout(5000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  try {
    await page.goto(`${URL}/custom.html`);
    await page.evaluate(() => localStorage.clear()); await page.reload();

    // the page lists every topic that has questions, with its true count, under its domain
    const shown = await page.$$eval('.obj-group', gs => gs.flatMap(g => [...g.querySelectorAll('.checkbox-item')].map(r => ({
      domain: g.querySelector('h3').textContent.trim(), id: r.querySelector('input').value,
      text: r.querySelector('span').textContent.trim(), n: r.querySelector('.obj-count').textContent.trim() }))));
    const listed = Object.keys(topic).filter(id => count[id]);
    ok(shown.length === listed.length, `the custom quiz lists ${shown.length} topics, ${listed.length} have questions`);
    for (const s of shown) {
      const t = topic[s.id];
      ok(t && s.domain === `${t.domain} ${D[t.domain]}` && s.text === `${t.id} ${t.label}` && s.n === `${count[t.id]} Qs`,
        `custom quiz shows ${JSON.stringify(s)}, bank has ${t && `${t.domain} ${D[t.domain]} / ${t.id} ${t.label} / ${count[t.id]}`}`);
    }

    // a quiz on one topic draws only from it (1.1 is the biggest, so it clears the 45 minimum alone)
    await page.click('#selectNoneBtn');
    await page.check('.checkbox-item input[value="1.1"]');
    await page.click('#startBtn');
    await page.waitForURL(/quiz\.html/);
    const s1 = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    ok(JSON.stringify(s1.objectives) === '["1.1"]' && s1.questions.every(q => q.sub === '1.1'), `a 1.1-only quiz holds [${[...new Set(s1.questions.map(q => q.sub))]}]`);
    const meta = await page.$eval('.question-meta', e => e.textContent.replace(/\s+/g, ' ').trim());
    ok(meta === `1.1 · ${topic['1.1'].label}`, `the question header reads "${meta}"`);

    // the newest questions play (or every topic, before any are written)
    const newest = B.filter(x => x.source && x.source.startsWith('written 30 Sept 2026'));
    const topics = newest.length ? [...new Set(newest.map(x => x.sub))] : Object.keys(topic);
    await page.evaluate(t => { localStorage.clear(); saveSession(buildSession({ mode: 'custom', count: 24, objectives: t, label: 'New questions', theme: 'green' })); }, topics);
    await page.goto(`${URL}/quiz.html`);
    let played = 0;
    for (let i = 0; i < 24 && (await page.$('.question-text')); i++) {
      const qt = await page.$eval('.question-text', e => e.textContent);
      const x = B.find(y => y.q === qt);
      const opts = await page.$$eval('.option', bs => bs.map(b => b.textContent));
      const want = opts.indexOf(x.options.find(o => o.correct).text);
      ok(want >= 0, `${x.id}: its correct answer isn't among the options on screen`);
      await page.locator('.option').nth(want).click();
      const cls = await page.locator('.option').nth(want).getAttribute('class');
      ok(/\bcorrect\b/.test(cls), `${x.id}: picking its right answer is marked wrong`);
      if (newest.includes(x)) played++;
      if (await page.$('#finishBtn')) { await page.click('#finishBtn'); break; }
      await page.click('#nextBtn');
    }
    if (newest.length) ok(played >= 3, `only ${played} of 24 questions on the newest topics were new ones`);  // random draw: well above 3 expected
    ok(/^100\/100$/.test(await page.$eval('.score-number', e => e.textContent.trim())), 'all right answers did not score 100');
    const bars = await page.$$eval('.bar-track', bs => bs.map(b => [b.getBoundingClientRect().width, b.querySelector('.bar-fill').getBoundingClientRect().width]));
    ok(bars.length && bars.every(([w, f]) => w > 0 && f >= w - 1), `score bars don't fill: ${JSON.stringify(bars.map(([w, f]) => `${Math.round(f)}/${Math.round(w)}px`))}`);
  } catch (e) { fails.push('could not drive the page — ' + String(e.message).split('\n')[0]); }
  ok(!errors.length, 'script errors: ' + errors.join(' | '));
  await browser.close(); srv.close();
  return fails;
}

if (process.argv.includes('--plant')) {
  const orig = read(ROOT);
  const custom = fs.readFileSync(path.join(ROOT, 'custom.html'), 'utf8');
  const quiz = fs.readFileSync(path.join(ROOT, 'quiz.html'), 'utf8');
  const data = f => { const d = JSON.parse(JSON.stringify(orig)); f(d); return { data: d }; };
  const PLANTS = {
    'topic renamed': data(d => { d.S['2.0'][2].label = 'Prioritize vulnerabilities'; }),
    'topic dropped': data(d => { d.S['3.0'].splice(2, 1); }),
    'topics out of order': data(d => { const s = d.S['1.0']; [s[0].label, s[1].label] = [s[1].label, s[0].label]; }),
    'domain renamed': data(d => { d.D['4.0'] = 'Reporting'; }),
    'question on an old topic': data(d => { d.B[0].sub = '1.9'; }),
    'question in the wrong domain': data(d => { const q = d.B.find(q => q.sub === '2.3'); q.objective = '1.0'; q.objectiveName = 'Security Operations'; }),
    'topic below 20': data(d => { const drop = new Set(d.B.filter(q => q.sub === '1.5').slice(0, 6).map(q => q.id)); d.B = d.B.filter(q => !drop.has(q.id)); }),
    // carries its own PENDING list, so it keeps working once the real list is empty
    'pending topic filled but still listed': { ...data(() => {}), pending: [...PENDING, '1.5'] },
    'two answers marked correct': data(d => { d.B[3].options.forEach(o => { o.correct = true; }); }),
    'option left without a why': data(d => { d.B[d.B.length - 1].options[2].why = ''; }),
    'right answer\'s why on a wrong option': data(d => { const q = d.B[50]; const r = q.options.find(o => o.correct); q.options.find(o => !o.correct).why = r.why; }),
    'duplicate id': data(d => { d.B[d.B.length - 1].id = d.B[0].id; }),
    'duplicate question text': data(d => { d.B[5].q = d.B[4].q; }),
    'page miscounts': { custom: ["poolCounts[code] = CYSA_QUESTIONS.filter(q => q.sub === code).length;", "poolCounts[code] = CYSA_QUESTIONS.filter(q => q.sub === code && q.id !== 'q1').length;"] },
    'page hides a topic': { custom: ["const subs = CYSA_SUB_OBJECTIVES[domainCode].filter(s => poolCounts[s.id] > 0);", "const subs = CYSA_SUB_OBJECTIVES[domainCode].filter(s => poolCounts[s.id] > 0 && s.id !== '3.2');"] },
    'one-topic quiz ignores the choice': { custom: ["const sel = selectedObjectives();\n      const requested", "const sel = codes.slice();\n      const requested"] },
    'right answer painted as wrong': { quiz: ["if (opt.correct) cls += ' correct';\n          else if (i === userAns)", "if (false) cls += ' correct';\n          else if (i === userAns)"] },
    'score bars left unpainted': { quiz: ["'<div class=\"bar-track\"><div class=\"bar-fill\" style=\"width:' + pct + '%\">", "'<div class=\"bar-track\"><div class=\"bar-fill\" style=\"width:0%\">"] },
  };
  let missed = 0;
  for (const [name, p] of Object.entries(PLANTS)) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cq-obj-'));
    fs.cpSync(ROOT, tmp, { recursive: true, filter: s => !s.includes(`${path.sep}.git`) });
    let stale = false;
    for (const [key, file, src] of [['custom', 'custom.html', custom], ['quiz', 'quiz.html', quiz]]) if (p[key]) {
      if (!src.includes(p[key][0])) stale = true; else fs.writeFileSync(path.join(tmp, file), src.replace(p[key][0], p[key][1]));
    }
    if (stale) { console.log(`STALE  ${name}: the plant changed nothing`); missed++; fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    if (p.data) write(tmp, p.data);
    const f = await run(tmp, p.pending || PENDING);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`${f.length ? 'CAUGHT' : 'MISSED'} ${name.padEnd(38)} ${(f[0] || '').slice(0, 110)}`);
    if (!f.length) missed++;
  }
  console.log(missed ? `${missed} plant(s) got through` : `all ${Object.keys(PLANTS).length} plants caught`);
  process.exit(missed ? 1 : 0);
} else {
  const fails = await run(process.argv[2] || ROOT);
  if (fails.length) { console.log('FAIL ' + fails.length); fails.slice(0, 30).forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log(`PASS — ${DOC.reduce((a, d) => a + d.topics.length, 0)} topics from the doc, every question filed and well formed with one correct answer, every finished topic at ${MIN}+ (${PENDING.length ? `${PENDING.length} still being filled: ${PENDING.join(' ')}` : 'none left to fill'}), the custom quiz lists true counts, a one-topic quiz draws only from it, the newest questions answered right are marked right and the score bars paint, no script errors`);
}
