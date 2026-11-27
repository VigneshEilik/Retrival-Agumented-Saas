// Copies non-TypeScript runtime assets into dist/ after `tsc`.
// Without this, the compiled server has no SQL migrations to run.
const fs = require('fs');
const path = require('path');

const assets = [
  ['src/db/migrations', 'dist/db/migrations'],
  ['src/evaluation/basic-rag-eval.json', 'dist/evaluation/basic-rag-eval.json'],
];

for (const [from, to] of assets) {
  const src = path.resolve(__dirname, '..', from);
  const dest = path.resolve(__dirname, '..', to);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log(`copied ${from} -> ${to}`);
}
