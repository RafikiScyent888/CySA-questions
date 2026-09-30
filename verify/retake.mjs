// Drives "Retake the ones I missed" end to end in Chromium:
//   - after a quiz, the button offers exactly the questions answered wrong
//   - the retake holds only those questions, with the answers reshuffled, and
//     each round is labelled; rounds repeat until nothing is missed, and then
//     "Every one right" shows with no retake button
//   - Pause and Resume keep the round
//   - the Full Custom Quiz (45 questions from custom.html) offers it too
//   - the new button, banner and note meet AAA on painted pixels
//   - no script errors
//   node verify/retake.mjs [dir]     dir defaults to the repo
//   node verify/retake.mjs --plant   proves each check can fail
// Needs Playwright. Not needed to run the site. Exit 1 on any failure.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const PW = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const KEY = 'cysa_quiz_session_v1';
const lum = c => { const f = v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

async function run(dir) {
  const fails = []; const ok = (c, m) => { if (!c) fails.push(m); };
  const srv = http.createServer((q, r) => { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(f, (e, b) => { r.writeHead(e ? 404 : 200, { 'content-type': TYPES[path.extname(f)] || 'text/plain' }); r.end(e ? '' : b); }); }).listen(0);
  const URL = `http://127.0.0.1:${srv.address().port}`;
  const pw = await import(PW); const { chromium } = pw.default || pw;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.setDefaultTimeout(5000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const session = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);

  // answer the quiz on screen; wrongIf(i, q) decides which to get wrong. Returns ids answered wrong.
  async function play(B, wrongIf, stopAfter = Infinity) {
    const wrong = [];
    for (let i = 0; i < 400; i++) {
      if (!(await page.$('.question-text'))) break;
      if (i >= stopAfter) return wrong;
      const qt = await page.$eval('.question-text', e => e.textContent);
      const q = B.find(x => x.q === qt);
      const opts = await page.$$eval('.option', bs => bs.map(b => b.textContent));
      const right = opts.indexOf(q.options.find(o => o.correct).text);
      const pick = wrongIf(i, q) ? (right + 1) % opts.length : right;
      if (pick !== right) wrong.push(q.id);
      await page.locator('.option').nth(pick).click();
      if (await page.$('#finishBtn')) { await page.click('#finishBtn'); break; }
      await page.click('#nextBtn');
    }
    return wrong;
  }
  async function aaa(sel) {
    const els = await page.$$(sel); const out = [];
    for (const el of els) {
      const fg = await el.evaluate(e => getComputedStyle(e).color.match(/\d+/g).slice(0, 3).map(Number));
      await el.scrollIntoViewIfNeeded();
      const box = await el.boundingBox(); if (!box) continue;
      await el.evaluate(e => { e.dataset.c = e.style.color; e.style.setProperty('color', 'transparent', 'important'); e.querySelectorAll('*').forEach(c => c.style.setProperty('color', 'transparent', 'important')); });
      const png = await page.screenshot({ clip: { x: box.x + 3, y: box.y + 3, width: Math.max(1, box.width - 6), height: Math.max(1, box.height - 6) } });
      await el.evaluate(e => { e.style.color = e.dataset.c; e.querySelectorAll('*').forEach(c => c.style.removeProperty('color')); });
      const bg = await page.evaluate(async b64 => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data, n = {}; for (let k = 0; k < d.length; k += 4) { const s = d[k] + ',' + d[k + 1] + ',' + d[k + 2]; n[s] = (n[s] || 0) + 1; } return Object.entries(n).sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number); }, png.toString('base64'));
      out.push([ratio(fg, bg), (await el.textContent()).trim().slice(0, 40)]);
    }
    return out;
  }
  try {
    await page.goto(`${URL}/index.html`);
    await page.evaluate(() => localStorage.clear()); await page.reload();
    const B = await page.evaluate(() => CYSA_QUESTIONS);

    // round 1: a 10-question quick quiz, three answered wrong
    await page.click('.tile[data-count="10"]');
    await page.waitForURL(/quiz\.html/);
    const wrong1 = await play(B, i => i % 3 === 0);
    const btn = await page.$('#retakeMissedBtn');
    ok(btn, 'no "Retake the ones I missed" button after missing questions');
    if (btn) {
      ok((await btn.textContent()).trim() === `Retake the ${wrong1.length} I missed`, `button reads "${(await btn.textContent()).trim()}", ${wrong1.length} were missed`);
      for (const [r, t] of await aaa('#retakeMissedBtn, .retake-note')) ok(r >= 7, `contrast, results: ${r.toFixed(2)}:1 < 7 "${t}"`);
      await btn.click(); await page.waitForURL(/quiz\.html/); await page.waitForSelector('.question-text');
      const s2 = await session();
      const ids2 = s2.questions.map(q => q.id);
      ok(ids2.length === wrong1.length && wrong1.every(id => ids2.includes(id)), `round 2 retake holds [${ids2}], expected exactly the missed [${wrong1}]`);
      ok(s2.round === 2, `round 2 session says round ${s2.round}`);
      const banner = await page.$eval('.retake-banner', e => e.textContent).catch(() => '');
      ok(/Retake round 2/.test(banner), `question banner reads "${banner}"`);
      for (const [r, t] of await aaa('.retake-banner')) ok(r >= 7, `contrast, quiz: ${r.toFixed(2)}:1 < 7 "${t}"`);
      const bankOrder = s2.questions.every(q => { const orig = B.find(x => x.id === q.id).options.map(o => o.text); return q.options.every((o, k) => o.text === orig[k]); });
      ok(!bankOrder, 'retake round keeps the answers in their original order');

      // round 2: get the first one wrong again
      const wrong2 = await play(B, i => i === 0);
      const heading = await page.$eval('.score-sub', e => e.textContent);
      ok(/retake round 2/.test(heading), `round 2 results heading reads "${heading}"`);
      ok(!(await page.$('.all-right')), '"Every one right" shown while one is still missed');
      await page.click('#retakeMissedBtn'); await page.waitForURL(/quiz\.html/); await page.waitForSelector('.question-text');

      // round 3: pause, resume from the dashboard, then finish all right
      await page.click('#pauseBtn'); await page.waitForURL(/index\.html/);
      await page.click('#resumeBtn'); await page.waitForURL(/quiz\.html/); await page.waitForSelector('.question-text');
      const s3 = await session();
      ok(s3.round === 3 && s3.questions.length === wrong2.length, `after Pause and Resume: round ${s3.round}, ${s3.questions.length} questions (expected round 3, ${wrong2.length})`);
      ok(/Retake round 3/.test(await page.$eval('.retake-banner', e => e.textContent).catch(() => '')), 'round banner lost after Pause and Resume');
      await play(B, () => false);
      ok(await page.$('.all-right'), 'no "Every one right" after a round with nothing missed');
      ok(!(await page.$('#retakeMissedBtn')), 'retake button still offered with nothing missed');
    }

    // the Full Custom Quiz: 45 questions from custom.html
    await page.goto(`${URL}/custom.html`);
    await page.click('#startBtn'); await page.waitForURL(/quiz\.html/);
    const sc = await session();
    ok(sc.questions.length === 45, `custom quiz has ${sc.questions.length} questions, expected 45`);
    const wrongC = await play(B, i => i % 9 === 4);
    const cbtn = await page.$('#retakeMissedBtn');
    ok(cbtn && (await cbtn.textContent()).trim() === `Retake the ${wrongC.length} I missed`, `custom quiz: retake button ${cbtn ? `reads "${(await cbtn.textContent()).trim()}"` : 'missing'}, ${wrongC.length} missed`);
  } catch (e) { fails.push('could not drive the page — ' + String(e.message).split('\n')[0]); }
  ok(!errors.length, 'script errors: ' + errors.join(' | '));
  await browser.close(); srv.close();
  return fails;
}

if (process.argv.includes('--plant')) {
  const PLANTS = {
    'retake uses the whole quiz': ['assets/app.js', "return !(a !== null && a !== undefined && q.options[a] && q.options[a].correct);", 'return true;'],
    'retake drops one missed question': ['assets/app.js', 'const picked = shuffle(missedIds.map(id => byId.get(id)).filter(Boolean));', 'const picked = shuffle(missedIds.slice(1).map(id => byId.get(id)).filter(Boolean));'],
    'round not counted': ['assets/app.js', 'round: (prev.round || 1) + 1', 'round: 1'],
    'no retake button': ['quiz.html', "(missed.length ? '<button class=\"btn btn-retake-missed\"", "(false ? '<button class=\"btn btn-retake-missed\""],
    'finish message too early': ['quiz.html', 'if (round > 1 && missed.length === 0) {', 'if (round > 1 && missed.length <= 1) {'],
    'button in the standard blue': ['assets/styles.css', '.btn-retake-missed { background: #0b3a82;', '.btn-retake-missed { background: #0d6efd;'],
    'answers not reshuffled on retake': ['assets/app.js', "    subLabel: subObjectiveLabel(q.sub),\n    options: shuffle(q.options)\n  }));\n  return {\n    sessionId: 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),\n    createdAt: Date.now(),\n    mode: prev.mode,", "    subLabel: subObjectiveLabel(q.sub),\n    options: q.options\n  }));\n  return {\n    sessionId: 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),\n    createdAt: Date.now(),\n    mode: prev.mode,"],
    'pause loses the round': ['quiz.html', "document.getElementById('pauseBtn').addEventListener('click', () => {\n      saveSession(session);", "document.getElementById('pauseBtn').addEventListener('click', () => {\n      session.round = 1; saveSession(session);"],
  };
  let missed = 0;
  for (const [name, [file, from, to]] of Object.entries(PLANTS)) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    if (!src.includes(from)) { console.log(`STALE  ${name}: the plant changed nothing`); missed++; continue; }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cq-rt-'));
    fs.cpSync(ROOT, tmp, { recursive: true, filter: s => !s.includes(`${path.sep}.git`) });
    fs.writeFileSync(path.join(tmp, file), src.replace(from, to));
    const f = await run(tmp);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`${f.length ? 'CAUGHT' : 'MISSED'} ${name.padEnd(36)} ${(f[0] || '').slice(0, 110)}`);
    if (!f.length) missed++;
  }
  console.log(missed ? `${missed} plant(s) got through` : `all ${Object.keys(PLANTS).length} plants caught`);
  process.exit(missed ? 1 : 0);
} else {
  const fails = await run(process.argv[2] || ROOT);
  if (fails.length) { console.log('FAIL ' + fails.length); fails.slice(0, 20).forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log('PASS — retake holds exactly the missed questions, answers reshuffled, rounds repeat and are labelled, Pause & Resume keeps the round, the Full Custom Quiz offers it, AAA on the new text, no script errors');
}
