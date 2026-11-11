// Construit dist/rumble-pop.html : un seul fichier jouable hors ligne (double-clic), sans serveur.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const out = await build({
  entryPoints: ['js/main.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2020',
  legalComments: 'none',
  alias: { three: './vendor/three.module.min.js' },
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('css/style.css', 'utf8');
const html = readFileSync('index.html', 'utf8')
  .replace('<link rel="stylesheet" href="css/style.css">', () => `<style>${css}</style>`)
  .replace(/<script type="importmap">[\s\S]*?<\/script>\n/, '')
  .replace('<script type="module" src="js/main.js"></script>', () => `<script>${js}</script>`);

mkdirSync('dist', { recursive: true });
writeFileSync('dist/rumble-pop.html', html);
console.log(`dist/rumble-pop.html : ${(html.length / 1024).toFixed(0)} Ko`);

// Variante sans squelette HTML (pour un hébergement qui fournit déjà <html>/<head>/<body>).
if (process.argv.includes('--embed')) {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
    .replace(/<meta charset[^>]*>\n?/, '')
    .replace(/<meta name="viewport"[^>]*>\n?/, '');
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
  const file = process.argv[process.argv.indexOf('--embed') + 1];
  writeFileSync(file, head + body);
  console.log(`${file} : variante intégrable`);
}
