// Drives the score card, question map, filters, Shuffle order, the lasting
// Missed list ("Study these first", "Retake all missed", "Practice this
// topic"), Reset and Easier reading (31 October 2026) in Chromium, across the
// dashboard, the Custom Quiz page and the quiz, and checks:
//   - the topic colours: one each, all different, white lettering over 7:1 on
//     every one, and each map square's border is its question's topic colour
//   - the parts bar: one part per topic, each as wide as its share
//   - the chips: true counts (All, each topic, new questions, Missed), and each
//     shows exactly its questions on the map; pressing one again shows all
//   - the map: right and wrong told by fill, a mark and words, a wrong number
//     struck through, the current question ringed; a square jumps there
//   - the score card: the score is right of answered, never of the whole
//     quiz; each topic's "n/t right" and its bar
//   - the Missed list: a wrong answer goes on, a right answer comes off;
//     "Study these first" lists its topics, most missed first; "Retake all
//     missed" is exactly the list; "Practice this topic" draws only from that
//     topic and includes its missed questions
//   - Reset asks first, clears this quiz only and keeps the Missed list
//   - leaving a quiz part-way and finishing with questions left ask first
//   - Shuffle order: off gives the bank's order and the answers as written,
//     remembered; switching part-way keeps every answer, even on a quiz
//     paused before this release (its questions carry no answer order)
//   - review from the results: a square opens that question, locked; one
//     screen at a time, so no button or heading is on the page twice
//   - Easier reading stays on across a reload; no script errors
//   - light or dark (31 October 2026): with nothing chosen the page follows the
//     device, even when its setting changes while the page is open; nothing is
//     saved until the button is pressed; the button names where it goes and
//     saves the choice under the program's key "cwp:theme", kept on every page
//     and winning over the device; a choice made on another site is honoured;
//     in dark mode every topic is its bright shade, dark lettering over 7:1
//   node verify/scorecard.mjs           the site in this repo
//   node verify/scorecard.mjs --plant   proves each check can fail
//   node verify/scorecard.mjs --plant --only=<name>   one plant
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
const SESSION = 'cysa_quiz_session_v1', MISSED = 'cysa_missed_v1', SHUF = 'cysa_shuffle_v1';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const lum = c => { const f = v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const cssRgb = s => (s.match(/\d+/g) || []).slice(0, 3).map(Number);
const WHITE = [255, 255, 255];
const DARK_INK = [7, 16, 33], THEME = 'cwp:theme';   // dark lettering on the bright shades (dark mode)
const isAns = a => a !== null && a !== undefined;

async function run(dir) {
  const srv = http.createServer((q, r) => { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { r.writeHead(e ? 404 : 200, { 'content-type': TYPES[path.extname(f)] || 'text/plain' }); r.end(e ? '' : b); }); }).listen(0);
  const U = `http://127.0.0.1:${srv.address().port}`;
  const pw = await import(PW); const { chromium } = pw.default || pw;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(5000);
  page.on('dialog', d => d.accept());   // the dashboard's own "discard your paused quiz?" prompt
  const fails = []; const ok = (c, m) => { if (!c) fails.push(m); };
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const S = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), SESSION);
  const missed = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), MISSED);
  const text = sel => page.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => null);
  const dialogOpen = () => page.evaluate(() => !!(document.getElementById('confirmDlg') && document.getElementById('confirmDlg').open));
  const shown = () => page.$$eval('.qtile', ts => ts.map(t => +t.dataset.pos));
  const counter = () => text('#qCounter');
  const sub = id => page.evaluate(id => TB.question(id).sub, id);
  const once = () => page.evaluate(() => ['missedAllBtn', 'resetBtn', 'scHead', 'stHead', 'qmap'].filter(id => document.querySelectorAll('#' + id).length > 1));
  // answer the current question right or wrong: one click answers here
  async function answer(right) {
    const s = await S(), q = s.questions[s.currentIndex], ci = q.options.findIndex(o => o.correct);
    await page.locator('#quizArea .option').nth(right ? ci : (ci + 1) % q.options.length).click();
    return q.id;
  }
  const forward = async () => { if (await page.$('#finishBtn')) await page.click('#finishBtn'); else await page.click('#nextBtn'); };
  async function finish(right = true) {
    for (let k = 0; k < 80 && !(await page.$('.score-hero')); k++) {
      if (await dialogOpen()) { await page.click('#confirmNo'); continue; }
      const s = await S();
      if (!isAns(s.userAnswers[s.currentIndex])) { await answer(right); continue; }
      await forward();
    }
  }
  const bankSession = (ids, extra) => page.evaluate(([k, ids, extra]) => {
    const byId = new Map(CYSA_QUESTIONS.map(q => [q.id, q]));
    const questions = ids.map(id => sessionQuestion(byId.get(id), false));
    localStorage.setItem(k, JSON.stringify(Object.assign({ sessionId: 'known', createdAt: 1, mode: 'custom', label: 'Known quiz', theme: 'green', objectives: [], requestedCount: ids.length, questions, currentIndex: 0, userAnswers: ids.map(() => null), finished: false, score: null, round: 1 }, extra || {})));
  }, [SESSION, ids, extra]);

  try {
    await page.goto(`${U}/index.html`); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await page.reload();

    // ---- topic colours ----
    const COL = await page.evaluate(() => TB.TOPIC_COLOR);
    const subs = await page.evaluate(() => TB.ALL);
    ok(subs.length === 15, `the site has ${subs.length} topics, expected the doc's 15`);
    ok(subs.every(id => /^#[0-9a-f]{6}$/i.test(COL[id] || '')), 'a topic has no colour');
    ok(new Set(subs.map(id => (COL[id] || '').toLowerCase())).size === subs.length, 'two topics share a colour');
    for (const id of subs) if (COL[id]) ok(ratio(hexRgb(COL[id]), WHITE) >= 7, `white lettering on ${id}'s colour ${COL[id]} is ${ratio(hexRgb(COL[id]), WHITE).toFixed(2)}:1, under 7:1`);
    ok((await page.$$('.missed-card')).length === 0, 'a fresh start shows a Missed list');
    ok(await page.isChecked('#shuffleChk'), 'Shuffle order is not on by default');
    ok((await text('#easierBtn')) === 'Easier reading: off', 'Easier reading does not start off');
    await page.goto(`${U}/custom.html`);
    ok(await page.isChecked('#shuffleSetup'), 'the Custom Quiz page does not show Shuffle order on');
    const dots = await page.$$eval('.checkbox-item', rs => rs.map(r => [r.querySelector('input').value, r.querySelector('.dot') ? getComputedStyle(r.querySelector('.dot')).backgroundColor : '']));
    ok(dots.length === subs.length, `the Custom Quiz page shows ${dots.length} topic colours`);
    for (const [id, bg] of dots) ok(cssRgb(bg).join() === hexRgb(COL[id]).join(), `the Custom Quiz page paints ${id} in ${bg}, not ${COL[id]}`);

    // ---- "Study these first": most missed first ----
    await page.goto(`${U}/index.html`);
    const pick = await page.evaluate(() => ({ a: CYSA_QUESTIONS.filter(q => q.sub === '1.1').slice(0, 1).map(q => q.id), b: CYSA_QUESTIONS.filter(q => q.sub === '3.3').slice(0, 2).map(q => q.id) }));
    await page.evaluate(([k, ids]) => { const m = {}; ids.forEach(id => m[id] = { n: 1, at: '2026-10-31' }); localStorage.setItem(k, JSON.stringify(m)); }, [MISSED, [...pick.a, ...pick.b]]);
    await page.reload();
    const study = await page.$$eval('.st-item', els => els.map(e => e.querySelector('.st-name').textContent.split(' ')[0] + ' ' + e.querySelector('.st-n').textContent.trim()));
    ok(study.join(' | ') === '3.3 2 missed | 1.1 1 missed', `"Study these first" reads [${study.join(' | ')}], expected 3.3 (2) before 1.1 (1)`);
    ok((await text('#missedAllBtn')) === 'Retake all missed (3)', `the dashboard's retake button reads "${await text('#missedAllBtn')}"`);
    const link = await page.$eval('.st-item a.linkish', a => [a.href, a.target]).catch(() => []);
    ok(link[0] === 'https://www.comptia.org/en-us/resources/certmaster-training/learn/' && link[1] === '_blank', `"Review in CertMaster Learn" goes to ${link[0]}`);
    const ptext = await page.$eval('.st-item [data-practise]', b => b.childNodes[0].textContent.trim()).catch(() => '');
    ok(ptext === 'Practice this topic', `the topic's link reads "${ptext}"`);
    ok(!/Practis/i.test(await page.evaluate(() => document.body.innerText)), 'no British "Practise" anywhere on the page');
    await page.evaluate(k => localStorage.removeItem(k), MISSED);

    // ---- a quiz paused before this release: no answer order, no filter ----
    const old = await page.evaluate(() => CYSA_QUESTIONS.filter(q => q.sub === '2.4').slice(0, 3).map(q => q.id));
    await page.evaluate(([k, ids]) => {
      const byId = new Map(CYSA_QUESTIONS.map(q => [q.id, q]));
      const questions = ids.map(id => { const q = byId.get(id); return { id: q.id, q: q.q, objective: q.objective, objectiveName: q.objectiveName, sub: q.sub, subLabel: q.sub, options: q.options.slice().reverse() }; });
      const wrong = questions[1].options.findIndex(o => !o.correct);
      localStorage.setItem(k, JSON.stringify({ sessionId: 'old', createdAt: 2, mode: 'quick', label: 'Paused before', theme: 'sun', objectives: [], requestedCount: 3, questions, currentIndex: 1, userAnswers: [null, wrong, null], finished: false, score: null }));
    }, [SESSION, old]);
    await page.goto(`${U}/quiz.html?resume=1`);
    ok((await page.$$('.qtile')).length === 3 && await page.$eval('.qtile[data-pos="1"]', t => t.classList.contains('st-wrong')).catch(() => false), 'a quiz paused before this release does not show its map and answer');
    const oldPick = (await S()).questions[1].options[(await S()).userAnswers[1]].text;
    await page.uncheck('#shuffleQuiz');
    const oS = await S(), oK = oS.questions.findIndex(q => q.id === old[1]);
    ok(oK >= 0 && isAns(oS.userAnswers[oK]) && oS.questions[oK].options[oS.userAnswers[oK]].text === oldPick, 'switching Shuffle order on a quiz paused before this release lost its answer');
    await page.check('#shuffleQuiz');
    await page.goto(`${U}/index.html`); await page.evaluate(k => localStorage.removeItem(k), SESSION);

    // ---- a known quiz: 6 from 2.2 (one of them new), 2 from 1.1, 2 from 3.3 ----
    const ids = await page.evaluate(() => {
      // new = written for the updated objectives; read straight from the bank, not through TB.isNew, which a plant may break
      const nw = q => (q.source || '').startsWith('written 30 Sept 2026');
      const of = (s, f, n) => CYSA_QUESTIONS.filter(q => q.sub === s && f(q)).slice(0, n).map(q => q.id);
      return [...of('2.2', q => !nw(q), 5), ...of('2.2', nw, 1), ...of('1.1', q => !nw(q), 2), ...of('3.3', q => !nw(q), 2)];
    });
    ok(ids.length === 10, 'could not build the known quiz');
    await bankSession(ids, { objectives: ['1.1', '2.2', '3.3'] });
    await page.goto(`${U}/quiz.html?resume=1`);

    ok((await text('.sc-big')) === '—', `the score before any answer reads "${await text('.sc-big')}"`);
    ok((await text('.sc-sub')) === '0 right of 0 answered · 10 left', `score line reads "${await text('.sc-sub')}"`);
    ok((await page.$$('.qtile')).length === 10, 'the map does not show the 10 questions');
    ok(await page.$eval('.qtile[data-pos="0"]', t => t.classList.contains('cur') && t.getAttribute('aria-current') === 'step').catch(() => false), 'question 1 is not ringed as the current one');
    const borders = await page.$$eval('.qtile', ts => ts.map(t => getComputedStyle(t).borderTopColor));
    for (let i = 0; i < 10; i++) { const s = await sub(ids[i]); ok(cssRgb(borders[i]).join() === hexRgb(COL[s]).join(), `square ${i + 1}'s border is ${borders[i]}, not ${s}'s colour`); }
    const segs = await page.$$eval('.seg', ss => ss.map(s => [s.dataset.filter, s.getBoundingClientRect().width]));
    ok(segs.map(s => s[0]).join() === '1.1,2.2,3.3', `parts bar shows [${segs.map(s => s[0])}]`);
    const sw = segs.reduce((a, s) => a + s[1], 0), want = { '1.1': 0.2, '2.2': 0.6, '3.3': 0.2 };
    for (const [id, w] of segs) ok(Math.abs(w / sw - want[id]) < 0.02, `part ${id} is ${(w / sw * 100).toFixed(0)}% of the bar, expected ${want[id] * 100}%`);
    const chips = await page.$$eval('.chip', cs => cs.map(c => [c.dataset.filter, c.querySelector('.chip-n').textContent, c.disabled]));
    const cmap = Object.fromEntries(chips.map(c => [c[0], c[1]]));
    ok(cmap.all === '0/10' && cmap['2.2'] === '0/6' && cmap['1.1'] === '0/2' && cmap['3.3'] === '0/2', `chip counts read ${JSON.stringify(cmap)}`);
    ok(cmap.new === '0/1', `the "New for the updated objectives" chip reads ${cmap.new}, expected 0/1`);
    ok(cmap.missed === '0' && (chips.find(c => c[0] === 'missed') || [])[2], 'the Missed chip is offered with nothing missed');

    // answers: 1 wrong, 2 right, 3 wrong
    const q1 = await answer(false); await page.click('#nextBtn');
    await answer(true); await page.click('#nextBtn');
    const q3 = await answer(false);
    const tile = i => page.$eval(`.qtile[data-pos="${i}"]`, t => ({ cls: t.className, txt: t.textContent, label: t.getAttribute('aria-label'), strike: getComputedStyle(t.querySelector('.qn')).textDecorationLine })).catch(() => ({}));
    const t1 = await tile(0), t2 = await tile(1);
    ok(/st-wrong/.test(t1.cls) && t1.txt.includes('✗') && /wrong$/.test(t1.label) && /line-through/.test(t1.strike), `a wrong square is not shown three ways: ${JSON.stringify(t1)}`);
    ok(/st-right/.test(t2.cls) && t2.txt.includes('✓') && /right$/.test(t2.label), `a right square is not marked: ${JSON.stringify(t2)}`);
    ok((await text('.sc-big')) === '33%', `score after 1 right of 3 reads "${await text('.sc-big')}"`);
    ok((await text('.sc-sub')) === '1 right of 3 answered · 7 left', `score line reads "${await text('.sc-sub')}"`);
    const rows = await page.$$eval('.sc-item', ls => ls.map(l => [l.querySelector('.sc-name').textContent.split(' ')[0], l.querySelector('.sc-n').textContent, l.querySelector('.sc-fill').style.width]));
    ok(JSON.stringify(rows) === JSON.stringify([['1.1', '0/2 right', '0%'], ['2.2', '1/6 right', '16.7%'], ['3.3', '0/2 right', '0%']]), `score card rows read ${JSON.stringify(rows)}`);
    const m1 = await missed();
    ok(Object.keys(m1).sort().join() === [q1, q3].sort().join(), `the Missed list holds [${Object.keys(m1)}], expected the two answered wrong [${q1}, ${q3}]`);
    ok((await text('.chip[data-filter="missed"] .chip-n')) === '2', 'the Missed chip does not count 2');
    ok((await text('.st-item .st-n')) === '2 missed', `"Study these first" reads "${await text('.st-item .st-n')}"`);

    // map jump
    await page.click('.qtile[data-pos="5"]');
    ok((await counter()) === '6 / 10', `jumping to square 6 shows "${await counter()}"`);
    ok(await page.$eval('.qtile[data-pos="5"]', t => t.classList.contains('cur')), 'square 6 is not ringed after the jump');
    ok(await page.$eval('#nextBtn', b => b.disabled).catch(() => false), 'Next works before an answer is chosen');
    ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'qtext'), 'a jump does not move focus to the question');

    // filters
    await page.click('.chip[data-filter="missed"]');
    ok((await shown()).join() === '0,2', `the Missed chip shows squares [${(await shown()).map(p => p + 1)}], expected 1 and 3`);
    ok(((await text('.qmap-n')) || '').includes('showing 2 of 10'), `map count reads "${await text('.qmap-n')}"`);
    ok((await counter()) === '1 / 10', 'the Missed chip does not move to the first missed question');
    ok((await text('#nextBtn')) === 'Next', 'Next does not step through the missed questions');
    await page.click('#nextBtn');
    ok((await text('#nextBtn')) === 'Show all questions', `at the last missed question the button reads "${await text('#nextBtn')}"`);
    await page.click('.chip[data-filter="missed"]');
    ok((await shown()).length === 10, 'pressing the Missed chip again does not show all');
    await page.click('.chip[data-filter="3.3"]');
    const s33 = []; for (let i = 0; i < 10; i++) if ((await sub(ids[i])) === '3.3') s33.push(i);
    ok((await shown()).join() === s33.join(), `the 3.3 chip shows [${await shown()}], expected [${s33}]`);
    await page.click('.chip[data-filter="new"]');
    ok((await shown()).length === 1, `the new-questions chip shows ${(await shown()).length} squares, expected 1`);
    await page.click('.seg[data-filter="1.1"]');
    ok(await page.$eval('.seg[data-filter="1.1"]', s => s.getAttribute('aria-pressed') === 'true'), 'a part of the bar does not show as chosen');
    ok((await shown()).length === 2, 'choosing a part of the bar does not show its questions');
    await page.click('.chip[data-filter="all"]');

    // reset: asks first, keeps the Missed list
    const before = (await S()).userAnswers.join();
    await page.click('#resetBtn');
    ok(await dialogOpen(), 'Reset does not ask first');
    if (await dialogOpen()) await page.click('#confirmNo');
    ok((await S()).userAnswers.join() === before, '"Keep my answers" still reset the quiz');
    await page.click('#resetBtn'); if (await dialogOpen()) await page.click('#confirmYes');
    const rs = await S();
    ok(rs.userAnswers.every(a => a === null) && rs.currentIndex === 0, 'Reset did not clear the answers');
    ok(Object.keys(await missed()).sort().join() === [q1, q3].sort().join(), 'Reset changed the Missed list');

    // shuffle part-way keeps answers
    await answer(false);
    const a0 = await S(), cq = a0.questions[a0.currentIndex], chose = cq.order[a0.userAnswers[a0.currentIndex]];
    const pos = await page.evaluate(() => Object.fromEntries(CYSA_QUESTIONS.map((q, i) => [q.id, i])));
    await page.uncheck('#shuffleQuiz');
    const off = await S();
    ok(off.questions.every((q, i) => i === 0 || pos[off.questions[i - 1].id] < pos[q.id]), 'Shuffle order off: the questions are not in the bank\'s order');
    ok(off.questions.every(q => q.order.join() === q.options.map((_, i) => i).join()), 'Shuffle order off: the answers are not as written');
    ok(off.questions[off.currentIndex].id === cq.id, 'switching Shuffle order moved to another question');
    const k2 = off.questions.findIndex(q => q.id === cq.id);
    ok(isAns(off.userAnswers[k2]) && off.questions[k2].order[off.userAnswers[k2]] === chose, 'switching Shuffle order lost the answer given');
    ok(await page.evaluate(k => localStorage.getItem(k), SHUF) === '0', 'Shuffle order off is not remembered');
    await page.check('#shuffleQuiz');

    // finishing with questions left asks first
    // the last square; Shuffle order was just switched, so it may hold the one already answered
    await page.click('.qtile[data-pos="9"]'); if (!isAns((await S()).userAnswers[9])) await answer(true); await forward();
    ok(await dialogOpen(), 'finishing with questions left does not ask first');
    if (await dialogOpen()) await page.click('#confirmNo');
    const f1 = await S();
    ok(!f1.finished && f1.currentIndex === f1.userAnswers.indexOf(null), '"Go to the first unanswered" did not go there');
    for (let i = 0; i < 25 && !(await page.$('.score-hero')); i++) {
      const s = await S();
      if (!isAns(s.userAnswers[s.currentIndex])) await answer(true);
      await forward();
      ok(!(await dialogOpen()), 'finishing with every question answered still asks');
      if (await dialogOpen()) await page.click('#confirmYes');
    }
    ok(!!(await page.$('.score-hero')), 'the quiz did not finish');

    // results: score card, review from the map, one screen at a time
    const fin = await S(), nRight = fin.questions.filter((q, i) => isAns(fin.userAnswers[i]) && q.options[fin.userAnswers[i]].correct).length;
    ok((await text('.sc-sub')) === `${nRight} right of 10 answered · 0 left`, `results score line reads "${await text('.sc-sub')}"`);
    ok(!(await page.$('.qtile.cur')), 'the results map rings a current question');
    ok(!(await once()).length, `on the results these are on the page twice: ${await once()}`);
    await page.click('.qtile[data-pos="0"]');
    ok(!!(await page.$('#backBtn')), 'a square on the results does not open the question for review');
    ok(await page.$$eval('#quizArea .option', os => os.length > 1 && os.every(o => o.disabled)), 'a reviewed question can be answered again');
    ok(!(await once()).length, `in review these are on the page twice: ${await once()}`);
    await page.click('#backBtn');
    ok(!!(await page.$('.score-hero')), '"Back to results" does not go back');

    // retake all missed: exactly the list; right answers clear it
    const ml = Object.keys(await missed());
    ok((await text('#missedAllBtn')) === `Retake all missed (${ml.length})`, `results retake button reads "${await text('#missedAllBtn')}"`);
    await page.click('#missedAllBtn'); await page.waitForLoadState();
    await page.waitForFunction(k => { const s = JSON.parse(localStorage.getItem(k) || 'null'); return s && s.mode === 'missed' && document.querySelector('.qtile'); }, SESSION).catch(() => {});
    const ma = await S();
    ok(ma.mode === 'missed' && ma.questions.map(q => q.id).sort().join() === ml.sort().join(), `"Retake all missed" holds [${ma.questions.map(q => q.id)}], expected the list [${ml}]`);
    ok(((await text('.retake-banner')) || '').startsWith('Your Missed list'), `its banner reads "${await text('.retake-banner')}"`);
    await finish(true);
    ok(Object.keys(await missed()).length === 0, 'answering right did not take questions off the Missed list');
    ok(((await text('.retake-banner.all-right')) || '').startsWith('Every one right. Your Missed list is empty.'), `finish reads "${await text('.retake-banner.all-right')}"`);

    // leaving part-way asks; practice a topic
    await page.goto(`${U}/index.html`); await page.click('.tile[data-count="10"]'); await page.waitForURL(/quiz\.html/);
    const wrongId = await answer(false), wsub = await sub(wrongId); await page.click('#nextBtn');
    const started = (await S()).sessionId;
    await page.click('#missedAllBtn');
    ok(await dialogOpen(), 'leaving a quiz part-way does not ask first');
    if (await dialogOpen()) await page.click('#confirmNo');
    ok((await S()).sessionId === started, '"Stay on this quiz" left the quiz');
    await page.click(`[data-practise="${wsub}"]`); if (await dialogOpen()) await page.click('#confirmYes');
    await page.waitForFunction(k => { const s = JSON.parse(localStorage.getItem(k) || 'null'); return s && s.mode === 'topic' && document.querySelector('.qtile'); }, SESSION).catch(() => {});
    const tp = await S(), tsubs = tp.questions.map(q => q.sub);
    const nTopic = await page.evaluate(s => CYSA_QUESTIONS.filter(q => q.sub === s).length, wsub);
    ok(tp.mode === 'topic' && tp.topic === wsub && tsubs.every(s => s === wsub), `"Practice this topic" (${wsub}) drew [${[...new Set(tsubs)]}]`);
    ok(tp.questions.length === Math.min(25, nTopic) && tp.questions.some(q => q.id === wrongId), `"Practice this topic" has ${tp.questions.length} questions${tp.questions.some(q => q.id === wrongId) ? '' : ', without the missed one'}`);
    ok(((await text('.retake-banner')) || '').startsWith(`Practicing ${wsub}`), `its banner reads "${await text('.retake-banner')}"`);
    ok(!/Practis/i.test(await page.evaluate(() => document.body.innerText)), 'no British "Practising" on the topic quiz');

    // shuffle off from the dashboard, remembered
    await page.goto(`${U}/index.html`);
    await page.uncheck('#shuffleChk'); await page.reload();
    ok(!(await page.isChecked('#shuffleChk')), 'Shuffle order off is forgotten on the next visit');
    await page.click('.tile[data-count="10"]'); await page.waitForURL(/quiz\.html/);
    const so = await S();
    ok(so.questions.every((q, i) => i === 0 || pos[so.questions[i - 1].id] < pos[q.id]) && so.questions.every(q => q.order.join() === q.options.map((_, i) => i).join()), 'a quiz started with Shuffle order off is shuffled');
    await page.goto(`${U}/index.html`); await page.check('#shuffleChk');

    // easier reading
    await page.click('#easierBtn');
    ok((await text('#easierBtn')) === 'Easier reading: on' && await page.$eval('#easierBtn', b => b.getAttribute('aria-pressed') === 'true'), 'the Easier reading button does not say it is on');
    await page.goto(`${U}/custom.html`);
    ok(await page.evaluate(() => document.documentElement.classList.contains('easier')), 'Easier reading is forgotten on the next page');
    ok((await text('#easierBtn')) === 'Easier reading: on', 'on the next page the button says off');
    ok(await page.evaluate(() => parseFloat(getComputedStyle(document.body).letterSpacing) > 0), 'Easier reading does not widen the letter spacing');
    await page.click('#easierBtn'); await page.reload();
    ok(!(await page.evaluate(() => document.documentElement.classList.contains('easier'))), 'Easier reading cannot be turned off');

    // light or dark
    const theme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const saved = () => page.evaluate(k => localStorage.getItem(k), THEME);
    const btn = () => page.$eval('#themeBtn', b => [b.textContent.replace(/\s+/g, ' ').trim(), b.getAttribute('aria-label')]).catch(() => []);
    const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundImage);
    await page.goto(`${U}/index.html`); await page.evaluate(k => localStorage.removeItem(k), THEME); await page.reload();
    ok((await theme()) === 'light', `on a light device with nothing chosen the page starts ${await theme()}, not light`);
    ok((await saved()) === null, `a theme (${await saved()}) is saved before the student chooses one`);
    let b1 = await btn();
    ok(b1[0] === 'Dark mode' && b1[1] === 'Switch to dark mode. Currently light mode.', `on the light page the theme button reads ${JSON.stringify(b1)}`);
    const lightBg = await bodyBg();
    await page.click('#themeBtn');
    ok((await theme()) === 'dark', 'the theme button does not switch to dark');
    ok((await saved()) === 'dark', `the dark choice is saved as ${await saved()}, not under the program's key`);
    ok((await bodyBg()) !== lightBg, 'dark mode does not repaint the page');
    b1 = await btn();
    ok(b1[0] === 'Light mode' && b1[1] === 'Switch to light mode. Currently dark mode.', `on the dark page the theme button reads ${JSON.stringify(b1)}`);
    const SH = await page.evaluate(() => TB.TOPIC_BRIGHT || {});
    const SUBS = await page.evaluate(() => TB.ALL);
    ok(SUBS.every(id => /^#[0-9a-f]{6}$/i.test(SH[id] || '')), 'a topic has no bright shade for the dark page');
    ok(new Set(SUBS.map(id => (SH[id] || '').toLowerCase())).size === SUBS.length, 'two topics share a bright shade');
    for (const id of SUBS) if (SH[id]) ok(ratio(hexRgb(SH[id]), DARK_INK) >= 7, `dark lettering on ${id}'s bright shade ${SH[id]} is ${ratio(hexRgb(SH[id]), DARK_INK).toFixed(2)}:1, under 7:1`);
    // the choice holds on every page
    for (const pg of ['custom.html', 'index.html']) {
      await page.goto(`${U}/${pg}`);
      ok((await theme()) === 'dark', `dark mode is forgotten on ${pg}`);
      ok(((await btn())[0] || '') === 'Light mode', `on ${pg} in dark mode the button reads ${JSON.stringify(await btn())}`);
      if (pg === 'custom.html') {
        const ddots = await page.$$eval('.checkbox-item', rs => rs.map(r => [r.querySelector('input').value, getComputedStyle(r.querySelector('.dot')).backgroundColor]));
        ok(ddots.length === SUBS.length, `in dark mode the setup shows ${ddots.length} topic colours`);
        for (const [id, bg] of ddots) if (SH[id]) ok(cssRgb(bg).join() === hexRgb(SH[id]).join(), `in dark mode ${id} is painted ${bg}, not its bright shade ${SH[id]}`);
      }
    }
    await page.click('#themeBtn'); await page.reload();
    ok((await theme()) === 'light' && (await saved()) === 'light', 'switching back to light is not kept');
    // the device: followed until the student chooses, live; then the choice wins
    for (const scheme of ['light', 'dark']) {
      const other = scheme === 'light' ? 'dark' : 'light';
      const ctx = await browser.newContext({ colorScheme: scheme }); const p2 = await ctx.newPage();
      const th2 = () => p2.evaluate(() => document.documentElement.getAttribute('data-theme'));
      await p2.goto(`${U}/index.html`); await p2.evaluate(() => localStorage.clear()); await p2.reload();
      ok((await th2()) === scheme, `on a device set to ${scheme}, with nothing chosen, the page starts ${await th2()}`);
      await p2.emulateMedia({ colorScheme: other }); await p2.waitForTimeout(150);
      ok((await th2()) === other, `with nothing chosen, the device changing to ${other} leaves the page ${await th2()}`);
      await p2.emulateMedia({ colorScheme: scheme }); await p2.waitForTimeout(150);
      await p2.evaluate(([k, v]) => localStorage.setItem(k, v), [THEME, other]); await p2.goto(`${U}/quiz.html`).catch(() => {}); await p2.goto(`${U}/index.html`);
      ok((await th2()) === other, `${other} chosen on another of the program's sites shows ${await th2()} here`);
      // flip the device and back, a beat apart: two flips in one frame report no change at all
      await p2.emulateMedia({ colorScheme: other }); await p2.waitForTimeout(150); await p2.emulateMedia({ colorScheme: scheme }); await p2.waitForTimeout(150);
      ok((await th2()) === other, `the device changing overrode the student's choice of ${other}: the page is ${await th2()}`);
      await ctx.close();
    }
  } catch (e) { fails.push('could not drive the page — ' + String(e.message).split('\n')[0] + ' (at ' + (String(e.stack).match(/scorecard\.mjs:\d+/g) || []).join(' < ') + ')'); }
  ok(!errors.length, 'script errors: ' + errors.join(' | '));
  await browser.close(); srv.close();
  return fails;
}

if (process.argv.includes('--plant')) {
  const PLANTS = {
    'British spelling back on the link': ['assets/testbank.js', '">Practice this topic<span', '">Practise this topic<span'],
    'British spelling back on the banner': ['quiz.html', '<strong>Practicing ', '<strong>Practising '],
    'the old CertMaster address': ['assets/testbank.js', 'const CERTMASTER_URL = "https://www.comptia.org/en-us/resources/certmaster-training/learn/";', 'const CERTMASTER_URL = "https://learn.comptia.org/login";'],
    'wrong answer not saved': ['assets/testbank.js', 'else m[id] = { n: ((m[id] && m[id].n) || 0) + 1, at: new Date().toISOString() };', 'else {}'],
    'right answer left on the list': ['assets/testbank.js', 'if (right) delete m[id];', 'if (right) {}'],
    'wrong square has no cross': ['assets/testbank.js', `s === "wrong" ? '<span class="mk" aria-hidden="true">&#10007;</span>'`, `s === "wrong" ? ''`],
    'wrong number not struck': ['assets/styles.css', 'button.qtile.st-wrong .qn { text-decoration: line-through; text-decoration-thickness: 2px; }', 'button.qtile.st-wrong .qn { }'],
    'current square not ringed': ['assets/testbank.js', 'class="qtile st-${s}${i === cur ? " cur" : ""}"', 'class="qtile st-${s}"'],
    'score over the whole quiz': ['assets/testbank.js', 'Math.round((right / answered) * 100)', 'Math.round((right / st.length) * 100)'],
    'Missed chip takes unanswered': ['assets/testbank.js', 'if (f === "missed") return st[i] === "wrong";', 'if (f === "missed") return st[i] !== "right";'],
    'new chip counts every sourced one': ['assets/testbank.js', 'typeof q.source === "string" && q.source.indexOf(NEW_SOURCE) === 0', 'typeof q.source === "string"'],
    'parts all one width': ['assets/testbank.js', 'style="${tc(id)};flex-grow:${t}"', 'style="${tc(id)};flex-grow:1"'],
    'two topics share a colour': ['assets/testbank.js', '"4.2": "#7e2998"', '"4.2": "#a30843"'],
    'a colour too light for lettering': ['assets/testbank.js', '"3.3": "#3c46ba"', '"3.3": "#6b7cff"'],
    'study list in topic order': ['assets/testbank.js', '.sort((a, b) => b.n - a.n || ALL.indexOf(a.id) - ALL.indexOf(b.id));', '.sort((a, b) => ALL.indexOf(a.id) - ALL.indexOf(b.id));'],
    'Reset empties the Missed list': ['quiz.html', '      if (!ok) return;\n      const byId = new Map(', '      if (!ok) return;\n      localStorage.removeItem(TB.KEYS.missed);\n      const byId = new Map('],
    'Reset without asking': ['quiz.html', "const ok = await TB.askConfirm({\n        title: 'Reset this quiz?',", "const ok = true || await TB.askConfirm({\n        title: 'Reset this quiz?',"],
    'leaving without asking': ['quiz.html', '      if (quizUnderway()) {', '      if (false) {'],
    'finishing without asking': ['quiz.html', '      if (left) {\n        const ok = await TB.askConfirm({', '      if (false) {\n        const ok = await TB.askConfirm({'],
    'Shuffle order off ignored': ['assets/app.js', 'function inOrder(list, mix) { return mix ? list :', 'function inOrder(list, mix) { return true ? list :'],
    'shuffle part-way loses answers': ['assets/app.js', 'session.userAnswers = session.questions.map(q => { const o = chosen.get(q.id); return o === null ? null : q.order.indexOf(o); });', 'session.userAnswers = session.questions.map(() => null);'],
    'old paused quiz breaks on shuffle': ['assets/app.js', 'return [q.id, q.order ? q.order[a] : bank.options.findIndex(o => o.text === q.options[a].text)];', 'return [q.id, q.order[a]];'],
    'retake all uses the whole bank': ['assets/testbank.js', 'const ids = missedList();\n    if (!ids.length) return;', 'const ids = CYSA_QUESTIONS.slice(0, 10).map((q) => q.id);\n    if (!ids.length) return;'],
    'practice draws from every topic': ['assets/testbank.js', 'const all = CYSA_QUESTIONS.filter((q) => q.sub === sub).map((q) => q.id);', 'const all = CYSA_QUESTIONS.map((q) => q.id);'],
    'results map rings a question': ['quiz.html', 'TB.mapHtml(its, st, its.map((_, i) => i), -1, true, session.mapOpen)', 'TB.mapHtml(its, st, its.map((_, i) => i), 0, true, session.mapOpen)'],
    'hidden results kept in review': ['quiz.html', "      resultsArea.innerHTML = '';  // one screen at a time", '      // one screen at a time'],
    'easier reading forgotten': ['assets/testbank.js', 'try { localStorage.setItem(KEYS.easier, on ? "1" : "0"); } catch (e) { /* storage off */ }', ''],
    'theme ignores the device': ['index.html', 't = (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";', 't = "light";'],
    'theme saved before choosing': ['index.html', 'try { t = localStorage.getItem("cwp:theme"); } catch (e) {}', 'try { t = localStorage.getItem("cwp:theme") || (localStorage.setItem("cwp:theme", "light"), "light"); } catch (e) {}'],
    'theme choice not saved': ['assets/testbank.js', 'try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* storage off */ }', ''],
    'theme saved on its own key': ['assets/testbank.js', 'const THEME_KEY = "cwp:theme";', 'const THEME_KEY = "cysa_theme";'],
    'button names the theme it is in': ['assets/testbank.js', '(next === "light" ? "Light mode" : "Dark mode")', '(next === "light" ? "Dark mode" : "Light mode")'],
    'device change not followed': ['assets/testbank.js', 'if (mq) { if (mq.addEventListener) mq.addEventListener("change", follow); else if (mq.addListener) mq.addListener(follow); }', ''],
    'device change beats a choice': ['assets/testbank.js', 'const follow = (e) => { if (chosen()) return;', 'const follow = (e) => {'],
    'theme lost on the setup page': ['custom.html', 'if (t !== "light" && t !== "dark") t = (window.matchMedia', 't = null; if (t !== "light" && t !== "dark") t = (window.matchMedia'],
    'a bright shade too dark for lettering': ['assets/testbank.js', '"4.1": "#cbbcff"', '"4.1": "#6a5aa8"'],
    'dark mode keeps the deep colours': ['assets/styles.css', ':root[data-theme="dark"] .dot { background: var(--tcb);', ':root[data-theme="dark"] .dot { background: var(--tc);'],
  };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cysa-scorecard-plant-'));
  let missedN = 0, ran = 0;
  const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
  for (const [name, [file, a, b]] of Object.entries(PLANTS)) {
    if (only && name !== only) continue;
    ran++;
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    if (src.split(a).length !== 2) { console.log(`STALE  ${name}: its target text is not in ${file} exactly once`); missedN++; continue; }
    const d = path.join(tmp, name.replace(/\W+/g, '-'));
    fs.mkdirSync(path.join(d, 'assets'), { recursive: true });
    for (const f of ['index.html', 'custom.html', 'quiz.html']) fs.copyFileSync(path.join(ROOT, f), path.join(d, f));
    for (const f of fs.readdirSync(path.join(ROOT, 'assets'))) if (fs.statSync(path.join(ROOT, 'assets', f)).isFile()) fs.copyFileSync(path.join(ROOT, 'assets', f), path.join(d, 'assets', f));
    fs.writeFileSync(path.join(d, file), src.replace(a, () => b));
    const f = await run(d);
    console.log(`${f.length ? 'CAUGHT' : 'MISSED'} ${name.padEnd(36)} ${(f[0] || '').slice(0, 100)}`);
    if (!f.length) missedN++;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(missedN ? `${missedN} plant(s) got through` : `all ${ran} plants caught`);
  process.exit(missedN ? 1 : 0);
} else {
  const fails = await run(ROOT);
  if (fails.length) { console.log('FAIL ' + fails.length); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log('PASS — topic colours, parts bar, chips, map, score card, Missed list (Study these first, Retake all missed, Practice this topic), Reset, leave and finish prompts, Shuffle order (also on a quiz paused before this release), review, one screen at a time, Easier reading across pages, light or dark (follows the device until chosen, the choice kept on every page and for the program), no script errors');
}
