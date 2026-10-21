// Sestaví instalovatelnou aplikaci do dist/jachtarska-knizka a náhled pro claude.ai do dist/nahled.html.
// Spuštění: node build.mjs   (stačí Node.js 18+, žádné balíčky)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'src', OUT = join('dist', 'jachtarska-knizka');
rmSync('dist', { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const app = readFileSync(join(SRC, 'app.html'), 'utf8');
if (!app.includes('<!--/HEAD-->')) throw new Error('V src/app.html chybí značka <!--/HEAD-->');
const [head, body] = app.split('<!--/HEAD-->');

const pwaHead = `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#102233">
<meta name="description" content="Jachtařská knížka – digitální záznam plaveb a praxe pro jachtaře Námořního klubu.">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Jacht-knížka">
`;
const pwaTail = `
<script>
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
</script>
</body>
</html>
`;
const cleanHead = head.replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, '');
writeFileSync(join(OUT, 'index.html'), pwaHead + cleanHead + '</head>\n<body>' + body + pwaTail);

for (const f of ['sw.js', 'manifest.webmanifest', 'JAK-NAINSTALOVAT.txt']) copyFileSync(join(SRC, f), join(OUT, f));
for (const f of readdirSync(join(SRC, 'icons'))) copyFileSync(join(SRC, 'icons', f), join(OUT, f));

// Náhled pro claude.ai (Artifact) = app.html beze změny
copyFileSync(join(SRC, 'app.html'), join('dist', 'nahled.html'));

console.log('Hotovo: dist/jachtarska-knizka (nahrát na web) a dist/nahled.html (náhled v Claude)');
