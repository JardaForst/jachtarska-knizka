// Vygeneruje dist/test-export.xlsx z ukázkových dat a zkontroluje souhrny.
// Spuštění: node tools/test-export.mjs   — výsledný soubor otevřete v Excelu.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const src = readFileSync('src/app.html', 'utf8');
const a = src.indexOf('// XLSX-START'), b = src.indexOf('// XLSX-END');
assert.ok(a > 0 && b > a, 'V src/app.html chybí značky // XLSX-START a // XLSX-END');

const core = new Function(src.slice(a, b) + '\nreturn { buildXlsx, sampleData, totals, voyageStats, legHours, legDays, migrate };')();
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

// Převod funkcí z verze 1
const m = core.migrate({ voyages: [{ role: 'Spolukapitán' }, { role: 'Člen posádky' }, { role: 'Výcvik' }, { role: 'Kapitán' }] });
assert.deepEqual(m.voyages.map(v => v.role), ['První důstojník', 'Posádka', 'Kurzant', 'Kapitán']);

const bytes = core.buildXlsx(db, '2026-10-21');
assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b); // ZIP hlavička "PK"
mkdirSync('dist', { recursive: true });
writeFileSync('dist/test-export.xlsx', bytes);
console.log('OK – souhrny sedí, soubor dist/test-export.xlsx je připravený k otevření v Excelu.');
