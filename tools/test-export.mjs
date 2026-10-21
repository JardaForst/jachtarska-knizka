// Vygeneruje dist/test-export.xlsx z ukázkových dat a zkontroluje souhrny.
// Spuštění: node tools/test-export.mjs   — výsledný soubor otevřete v Excelu.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const src = readFileSync('src/app.html', 'utf8');
const a = src.indexOf('// XLSX-START'), b = src.indexOf('// XLSX-END');
assert.ok(a > 0 && b > a, 'V src/app.html chybí značky // XLSX-START a // XLSX-END');

const core = new Function(src.slice(a, b) + '\nreturn { buildXlsx, sampleData, totals, voyageStats };')();
const db = core.sampleData();
db.voyages.push({ id: 'x', name: 'Kyklady <test> & "uvozovky"', role: 'Člen posádky', boat: 'Aura', area: 'Řecko', kind: 'Charter' });
db.legs.push({ id: 'y', voyageId: 'x', date: '2026-06-03', from: 'Lavrio', to: 'Kea', nm: '24', bft: '6', sea: '4', windDir: 'S', notes: 'meltemi' });

const t = core.totals(db);
assert.equal(t.nm, 133.7);
assert.equal(t.capNm, 109.7);
assert.equal(t.days, 6);
assert.equal(t.voyages, 2);

const bytes = core.buildXlsx(db, '2026-10-21');
assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b); // ZIP hlavička "PK"
mkdirSync('dist', { recursive: true });
writeFileSync('dist/test-export.xlsx', bytes);
console.log('OK – souhrny sedí, soubor dist/test-export.xlsx je připravený k otevření v Excelu.');
