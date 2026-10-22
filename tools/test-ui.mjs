// Test obrazovek: v prohlížeči (velikost telefonu) projde hlavní scénáře sestavené aplikace.
// Spuštění: node build.mjs && node tools/test-ui.mjs
// Poprvé je potřeba: npm install && npx playwright install chromium
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const ROOT = join('dist', 'jachtarska-knizka');
const KEY = 'ifp-lodni-denik-v1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  try {
    const data = await readFile(join(ROOT, p.replace(/\.\./g, '')));
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(data);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const URL_ = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: 'cs-CZ', acceptDownloads: true, serviceWorkers: 'block' });
// Písma z Google Fonts nejsou pro test potřeba (a v CI zdržují)
await context.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_FAILED/.test(m.text())) errors.push(m.text()); });

// ---- pomocníci ----
const title = () => page.locator('#bar h1').textContent();
const toast = () => page.locator('#toast').textContent();
const tally = async () => (await page.locator('.tally b').allTextContents()).join(' / ');
const act = (a, extra = '') => page.locator(`[data-a="${a}"]${extra}`).first().click();
const fill = async (id, v) => { await page.fill('#' + id, v); await page.dispatchEvent('#' + id, 'change'); };
const store = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
const reset = async (data = null) => {
  await page.goto(URL_);
  await page.evaluate(([k, d]) => { localStorage.clear(); if (d) localStorage.setItem(k, JSON.stringify(d)); }, [KEY, data]);
  await page.goto(URL_);
};
let ok = 0;
async function step(name, fn) {
  try { await fn(); ok++; console.log('  ✓ ' + name); }
  catch (e) { console.log('  ✗ ' + name + '\n    ' + e.message.split('\n').join('\n    ')); await done(1); }
}
async function done(code) { await browser.close(); server.close(); process.exit(code); }

console.log('Test obrazovek (' + URL_ + ')');

await step('První spuštění: ukázková plavba a souhrn praxe', async () => {
  await reset();
  assert.equal(await page.title(), 'Jachtařská knížka');
  assert.equal(await title(), 'Jachtařská knížka');
  assert.equal(await page.locator('.row').count(), 1);
  assert.equal(await tally(), '109,7 / 5 / 1 / 109,7');
});

await step('Šířka 360 px: stránka nepřetéká do strany', async () => {
  for (const go of [null, 'newVoyage']) {
    if (go) await act(go);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 0, `přetéká o ${over} px`);
  }
  await act('back');
});

await step('Nová plavba začíná volbou způsobu zápisu', async () => {
  await act('newVoyage');
  assert.equal(await title(), 'Nová plavba');
  assert.deepEqual(await page.locator('.choice b').allInnerTexts(), ['Celá plavba jedním zápisem', 'Po etapách']);
});

await step('Jeden zápis: kontroly povinných polí a čísel', async () => {
  await act('pickMode', '[data-mode="summary"]');
  assert.ok(await page.locator('#v_nm').isVisible());
  await act('saveVoyage'); assert.match(await toast(), /název plavby/);
  await fill('v_name', 'Jadran 2025');
  await act('saveVoyage'); assert.match(await toast(), /od kdy/);
  await fill('v_from', '2025-07-05'); await fill('v_to', '2025-07-12');
  assert.equal(await page.inputValue('#v_days'), '8', 'dny na moři se mají předvyplnit z Od–Do');
  await act('saveVoyage'); assert.match(await toast(), /kolik mil/);
  await fill('v_nm', '142,5'); await fill('v_sail', '200');
  await act('saveVoyage'); assert.match(await toast(), /Pod plachtami/);
  await fill('v_sail', '98'); await fill('v_days', '9');
  await act('saveVoyage'); assert.match(await toast(), /jen 8 dní/);
});

await step('Jeden zápis: uložení, detail a souhrn praxe', async () => {
  await fill('v_days', '6'); await fill('v_route', 'Split – Hvar – Vis – Split');
  await page.selectOption('#v_bft', '5');
  await act('saveVoyage');
  assert.equal(await title(), 'Jadran 2025');
  assert.equal(await tally(), '142,5 / 6 / 0 / 5');
  assert.match(await page.locator('#view').innerText(), /Split – Hvar – Vis – Split/);
  assert.match(await page.locator('#dock').innerText(), /UPRAVIT ZÁPIS/i);
  await act('back');
  assert.equal(await title(), 'Jachtařská knížka', 'Zpět z nové plavby vede na úvod');
  assert.equal(await tally(), '252,2 / 11 / 2 / 252,2');
  assert.match(await page.locator('.subline').innerText(), /Pod plachtami 98 NM/);
  assert.equal(await page.locator('.row', { hasText: 'Jadran 2025' }).locator('.chip.sum').count(), 1);
});

await step('Po etapách: etapa přes noc a kontrola času připlutí', async () => {
  await act('newVoyage'); await act('pickMode', '[data-mode="legs"]');
  assert.equal(await page.locator('#v_nm').count(), 0, 'formulář po etapách nemá souhrnná pole');
  await fill('v_name', 'Kyklady 2026'); await act('saveVoyage');
  assert.equal(await title(), 'Kyklady 2026');
  await act('newLeg');
  await fill('l_date', '2026-06-04');
  assert.equal(await page.inputValue('#l_arrDate'), '2026-06-04');
  await fill('l_dep', '22:00'); await fill('l_arr', '08:30');
  await fill('l_from', 'Lavrio'); await fill('l_to', 'Milos'); await fill('l_nm', '80'); await fill('l_sail', '60');
  await act('saveLeg'); assert.match(await toast(), /Připlutí je dřív než vyplutí/);
  await fill('l_arrDate', '2026-06-05');
  await act('saveLeg');
  assert.equal(await title(), 'Kyklady 2026');
  const leg = await page.locator('.leg').innerText();
  assert.match(leg, /– 5\. 6\./); assert.match(leg, /10,5 h/);
  assert.equal(await tally(), '80 / 2 / 0 / –');
});

await step('Posun data vyplutí posune i připlutí', async () => {
  await page.locator('.leg').click();
  await fill('l_date', '2026-06-10');
  assert.equal(await page.inputValue('#l_arrDate'), '2026-06-11');
  await act('back');
});

await step('Úprava plavby: Zpět stačí zmáčknout jednou', async () => {
  await act('editVoyage'); await fill('v_crew', '4 osoby'); await act('saveVoyage');
  assert.equal(await title(), 'Kyklady 2026');
  await act('back');
  assert.equal(await title(), 'Jachtařská knížka');
});

await step('Přepnutí etapy → jeden zápis: předvyplnění a smazání etap', async () => {
  await page.locator('.row', { hasText: 'Kornati' }).click();
  await act('switchMode');
  assert.match(await page.locator('.confirm').innerText(), /5 etap se smaže/);
  await act('switchMode', '[data-now]');
  assert.equal(await title(), 'Upravit plavbu');
  assert.equal(await page.inputValue('#v_nm'), '109,7');
  assert.equal(await page.inputValue('#v_days'), '5');
  assert.match(await page.inputValue('#v_route'), /^Biograd na Moru – ACI Žut/);
  await act('saveVoyage');
  assert.equal(await tally(), '109,7 / 5 / 1,5 / 5');
  assert.equal((await store()).legs.filter(l => l.voyageId === 'ukazka').length, 0);
});

await step('Přepnutí jeden zápis → etapy', async () => {
  await act('switchMode'); await act('switchMode', '[data-now]');
  assert.match(await page.locator('#dock').innerText(), /PŘIDAT ETAPU/i);
  assert.equal(await tally(), '0 / 0 / 0 / –');
  assert.equal((await store()).voyages.find(v => v.id === 'ukazka').sumNm, undefined);
});

await step('Smazání plavby s potvrzením', async () => {
  await act('delVoyage', ':not([data-now])');
  assert.match(await page.locator('.confirm').innerText(), /Smazat plavbu\?/);
  await act('cancel'); assert.equal(await page.locator('.confirm').count(), 0);
  await act('delVoyage', ':not([data-now])'); await act('delVoyage', '.danger[data-now]');
  assert.equal(await title(), 'Jachtařská knížka');
  assert.equal(await page.locator('.row', { hasText: 'Kornati' }).count(), 0);
});

await step('Data vydrží znovunačtení stránky', async () => {
  await page.reload();
  const names = await page.locator('.row .t').evaluateAll(els => els.map(e => e.firstChild.textContent));
  assert.deepEqual(names.sort(), ['Jadran 2025', 'Kyklady 2026']);
});

let backup;
await step('Záloha a obnova v jiném (prázdném) zařízení', async () => {
  const [dl] = await Promise.all([page.waitForEvent('download'), act('backup')]);
  assert.match(dl.suggestedFilename(), /^jachtarska-knizka-zaloha-\d{4}-\d{2}-\d{2}\.json$/);
  backup = JSON.parse(await readFile(await dl.path(), 'utf8'));
  assert.equal(backup.voyages.length, 2);
  assert.match(await page.locator('#view').innerText(), /Poslední záloha/);
  await reset({ voyages: [], legs: [], meta: {} });
  assert.equal(await page.locator('.row').count(), 0);
  await page.setInputFiles('#importFile', { name: 'zaloha.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.waitForFunction(() => document.querySelectorAll('.row').length === 2);
  assert.match(await toast(), /Načteno ze zálohy: 2 plavby, 1 etapa/);
});

await step('Načtení nesprávného souboru jako zálohy', async () => {
  await page.setInputFiles('#importFile', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
  await page.waitForFunction(() => /Tohle není záloha/.test(document.getElementById('toast').textContent));
});

await step('Export do Excelu', async () => {
  const [dl] = await Promise.all([page.waitForEvent('download'), act('xlsx')]);
  assert.match(dl.suggestedFilename(), /^jachtarska-knizka-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const bytes = await readFile(await dl.path());
  assert.equal(bytes.subarray(0, 2).toString(), 'PK');
  assert.ok(bytes.includes('Jadran 2025') && bytes.includes('Kyklady 2026'));
});

await step('Převod dat ze starší verze (funkce „Člen posádky“ → Posádka)', async () => {
  await reset({ voyages: [{ id: 'o', name: 'Stará plavba', role: 'Člen posádky' }], legs: [{ id: 'l', voyageId: 'o', date: '2025-05-01', nm: '12' }], meta: {} });
  assert.equal(await page.locator('.row .chip').textContent(), 'Posádka');
  await page.locator('.row').click();
  assert.match(await page.locator('.leg').innerText(), /1\. 5\./);
});

await step('Žádné chyby v konzoli prohlížeče', async () => {
  assert.deepEqual(errors, []);
});

console.log(`OK – ${ok} scénářů prošlo.`);
await done(0);
