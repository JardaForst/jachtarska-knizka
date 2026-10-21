// Vygeneruje dist/test-export.xlsx z ukázkových dat a zkontroluje souhrny.
// Spuštění: node tools/test-export.mjs   — výsledný soubor otevřete v Excelu.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const r1 = v => Math.round(v * 10) / 10;

const src = readFileSync('src/app.html', 'utf8');
const a = src.indexOf('// XLSX-START'), b = src.indexOf('// XLSX-END');
assert.ok(a > 0 && b > a, 'V src/app.html chybí značky // XLSX-START a // XLSX-END');

const core = new Function(src.slice(a, b) + '\nreturn { buildXlsx, sampleData, totals, voyageStats, legHours, legDays, migrate, summaryFromLegs };')();
const db = core.sampleData();
db.voyages.push({ id: 'x', name: 'Kyklady <test> & "uvozovky"', role: 'Posádka', boat: 'Aura', area: 'Řecko', kind: 'Charter' });
db.legs.push({ id: 'y', voyageId: 'x', date: '2026-06-03', from: 'Lavrio', to: 'Kea', nm: '24', bft: '6', sea: '4', windDir: 'S', notes: 'meltemi' });

const t = core.totals(db);
assert.equal(t.nm, 133.7);
assert.equal(t.capNm, 109.7);
assert.equal(t.days, 6);
assert.equal(t.voyages, 2);

// Etapa přes více dní: vyplutí 4. 6. 22:00, připlutí 6. 6. 08:30 → 3 dny na moři, 34,5 h
const multi = { id: 'z', voyageId: 'x', date: '2026-06-04', dep: '22:00', arrDate: '2026-06-06', arr: '08:30', from: 'Kea', to: 'Milos', nm: '180' };
db.legs.push(multi);
assert.deepEqual(core.legDays(multi), ['2026-06-04', '2026-06-05', '2026-06-06']);
assert.equal(core.legHours(multi), 34.5);
assert.equal(core.legHours({ date: '2026-06-04', dep: '10:00', arr: '09:00' }), null); // připlutí před vyplutím
const sx = core.voyageStats(db, 'x');
assert.equal(sx.days, 4);
assert.equal(sx.last, '2026-06-06');

// Plavba jedním souhrnným zápisem: čísla z plavby, případné etapy se ignorují
db.voyages.push({ id: 's', mode: 'summary', name: 'Jadran souhrn', role: 'Kapitán', from: '2025-07-05', to: '2025-07-12',
  sumNm: '142,5', sumSailNm: '98', sumDays: '6', sumNightH: '3', sumMotorH: '12,5', sumBft: '5', route: 'Split – Hvar – Vis – Split' });
db.legs.push({ id: 'ign', voyageId: 's', date: '2025-07-06', nm: '999' });
const ss = core.voyageStats(db, 's');
assert.equal(ss.summary, true);
assert.equal(ss.nm, 142.5); assert.equal(ss.sail, 98); assert.equal(ss.days, 6); assert.equal(ss.maxBft, 5);
const t2 = core.totals(db);
assert.equal(t2.nm, r1(133.7 + 180 + 142.5));
assert.equal(t2.capNm, r1(109.7 + 142.5));
db.legs = db.legs.filter(l => l.id !== 'ign');

// Přepnutí z etap na souhrn: předvyplní se součty a trasa
const sf = core.summaryFromLegs(db, 'ukazka');
assert.equal(sf.mode, 'summary');
assert.equal(sf.sumNm, '109,7'); assert.equal(sf.sumDays, '5'); assert.equal(sf.from, '2026-09-12'); assert.equal(sf.to, '2026-09-16');
assert.equal(sf.route, 'Biograd na Moru – ACI Žut – Levrnaka – Skradin – Primošten – Biograd na Moru');

// Převod funkcí z verze 1
const m = core.migrate({ voyages: [{ role: 'Spolukapitán' }, { role: 'Člen posádky' }, { role: 'Výcvik' }, { role: 'Kapitán' }] });
assert.deepEqual(m.voyages.map(v => v.role), ['První důstojník', 'Posádka', 'Kurzant', 'Kapitán']);

const bytes = core.buildXlsx(db, '2026-10-21');
assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b); // ZIP hlavička "PK"
assert.ok(Buffer.from(bytes).includes('<f>SUM(P2:P4)</f><v>456.2</v>'), 'List Plavby: chybí řádek Celkem se součtem NM');
mkdirSync('dist', { recursive: true });
writeFileSync('dist/test-export.xlsx', bytes);
console.log('OK – souhrny sedí, soubor dist/test-export.xlsx je připravený k otevření v Excelu.');
