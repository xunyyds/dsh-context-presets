import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(join(here, path), 'utf8');

const MODULES = [
  'src/core/capacity.js',
  'src/core/document.js',
  'src/core/plan.js',
  'src/core/menu-items.js',
  'src/client/styles.js',
  'src/client/primitives.js',
  'src/client/dom.js',
  'src/client/fallback.js',
  'src/client/popover.js',
  'src/client/service.js',
  'src/client/panel.js',
  'src/client/dialog.js',
  'src/client/chip.js',
  'src/client/slots.js',
  'src/client/index.js',
];

function stripImports(source, file) {
  const out = [];
  let skipping = false;
  for (const line of source.split('\n')) {
    if (!skipping && /^import\s/.test(line)) {
      if (/from\s+['"][^'"]+['"];?\s*$/.test(line)) continue;
      skipping = true;
      continue;
    }
    if (skipping) {
      if (/from\s+['"][^'"]+['"];?\s*$/.test(line)) skipping = false;
      continue;
    }
    out.push(line);
  }
  const body = out.join('\n');
  if (/^import\s/m.test(body)) throw new Error(`${file}: import statement survived stripping`);
  return body;
}

function stripExports(source, file) {
  const body = source.replace(/^export\s+(const|function|let|class)\s/gm, '$1 ');
  if (/^export\s/m.test(body)) throw new Error(`${file}: export keyword survived stripping`);
  return body;
}

function collectDeclarations(source, file, seen) {
  for (const match of source.matchAll(/^(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    const name = match[1];
    if (seen.has(name)) throw new Error(`${file}: duplicate top-level declaration "${name}"`);
    seen.add(name);
  }
}

function assertNoComments(source, file) {
  if (source.includes('/*') || source.includes('*/')) {
    throw new Error(`${file}: block comment found`);
  }
  for (const line of source.split('\n')) {
    if (line.trimStart().startsWith('//')) throw new Error(`${file}: line comment found`);
  }
}

const seen = new Set();
const bodies = [];
for (const file of MODULES) {
  const source = stripExports(stripImports(read(file), file), file);
  assertNoComments(source, file);
  collectDeclarations(source, file, seen);
  bodies.push(source.trim());
}

const pkg = JSON.parse(read('package.json'));
const header = `window.__ModuleLoader__.load({id:'dsh-context-presets',factory:(require)=>{
const React = require('react');
`;
const footer = `
return { name, inject, apply };
}});
`;
const bundle = `${header}${bodies.join('\n\n')}${footer}`;

mkdirSync(join(here, 'lib'), { recursive: true });
writeFileSync(join(here, 'lib', 'client.js'), bundle, 'utf8');
copyFileSync(join(here, 'src', 'host', 'index.js'), join(here, 'lib', 'index.js'));

console.log(`lib/client.js  ${bundle.length} bytes`);
console.log(`lib/index.js   ${read('src/host/index.js').length} bytes`);
console.log(`modules        ${MODULES.length}`);
console.log(`version        ${pkg.version}`);
