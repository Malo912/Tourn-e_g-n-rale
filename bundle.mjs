// Tiny dependency-free bundler for this project's ES modules -> one self-contained HTML file.
// Supports the import/export forms used in src/ (named imports, namespace imports, export declarations).
// Usage: node tools/bundle.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const entry = 'src/main.js';
const mods = new Map(); // id -> {code, deps}
const order = [];

function resolve(from, spec) {
  if (!spec.startsWith('.')) throw new Error(`Bare import not supported: ${spec} (in ${from})`);
  return path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
}

function transform(id, src) {
  const exportsList = [];
  const deps = [];
  let code = src.replace(/^import\s+([\s\S]+?)\s+from\s+['"](.+?)['"];?[ \t]*$/gm, (m, what, spec) => {
    const dep = resolve(id, spec);
    deps.push(dep);
    what = what.trim();
    if (what.startsWith('* as ')) return `const ${what.slice(5).trim()} = __req(${JSON.stringify(dep)});`;
    if (what.startsWith('{')) {
      const inner = what.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
        const [a, b] = s.split(/\s+as\s+/);
        return b ? `${a}: ${b}` : a;
      });
      return `const { ${inner.join(', ')} } = __req(${JSON.stringify(dep)});`;
    }
    throw new Error(`Unsupported import form in ${id}: ${m}`);
  });
  code = code.replace(/^export\s+(async\s+function|function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm, (m, kw, name) => {
    exportsList.push(name);
    return `${kw} ${name}`;
  });
  code = code.replace(/^export\s*\{([^}]*)\};?/gm, (m, inner) => {
    for (const s of inner.split(',').map((x) => x.trim()).filter(Boolean)) {
      const [a, b] = s.split(/\s+as\s+/);
      exportsList.push(b ? `${b}:${a}` : a);
    }
    return '';
  });
  if (/^export\s+default/m.test(code)) throw new Error(`export default not supported (${id})`);
  if (/^\s*import\s/m.test(code)) throw new Error(`Unparsed import left in ${id}`);
  const tail = exportsList.map((e) => {
    const [name, local] = e.includes(':') ? e.split(':') : [e, e];
    return `__e.${name} = ${local};`;
  }).join('\n');
  return { code: `${code}\n${tail}`, deps };
}

const visiting = new Set();
function visit(id) {
  if (mods.has(id)) return;
  if (visiting.has(id)) throw new Error('Circular import detected at ' + id);
  visiting.add(id);
  const src = fs.readFileSync(path.join(root, id), 'utf8');
  const t = transform(id, src);
  for (const d of t.deps) visit(d);
  visiting.delete(id);
  mods.set(id, t);
  order.push(id);
}
visit(entry);

let js = `(function(){'use strict';\nconst __mods = {}, __cache = {};\nfunction __req(p){ if (__cache[p]) return __cache[p]; const e = {}; __cache[p] = e; __mods[p](e); return e; }\n`;
for (const id of order) js += `\n// ---- ${id}\n__mods[${JSON.stringify(id)}] = function(__e){\n${mods.get(id).code}\n};\n`;
js += `\n__req(${JSON.stringify(entry)});\n})();\n`;
// guard against "</script" inside the bundle
js = js.replace(/<\/script/gi, '<\\/script');

const css = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Lilita+One&family=Pacifico&family=Patrick+Hand&display=swap">';
const bodyHTML = '<canvas id="gl" tabindex="0"></canvas>\n<div id="overlay"></div>\n<div id="ui"></div>';

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const standalone = `<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>Tournée Générale</title>\n${fonts}\n<style>\n${css}\n</style>\n</head>\n<body>\n${bodyHTML}\n<script>\n${js}</script>\n</body>\n</html>\n`;
fs.writeFileSync(path.join(root, 'dist/tournee-generale.html'), standalone);
// artifact flavour: the host adds the document skeleton
const artifact = `<title>Tournée Générale</title>\n${fonts}\n<style>\n${css}\n</style>\n${bodyHTML}\n<script>\n${js}</script>\n`;
fs.writeFileSync(path.join(root, 'dist/artifact.html'), artifact);
console.log(`Bundled ${order.length} modules, ${(js.length / 1024).toFixed(0)} KB JS, ${(css.length / 1024).toFixed(0)} KB CSS`);
