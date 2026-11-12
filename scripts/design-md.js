/*
 * Reads the YAML front matter of a DESIGN.md (Google's format) into design tokens.
 * A small parser for the subset DESIGN.md uses: nested maps, scalars, quoted strings,
 * and inline { a: b } maps. No dependencies.
 */
const fs = require('fs');

function parseScalar(raw) {
  let v = raw.trim();
  if (v === '') return '';
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  if (v.startsWith('{') && v.endsWith('}')) {
    const obj = {};
    splitTop(v.slice(1, -1)).forEach((pair) => {
      const i = pair.indexOf(':');
      if (i > -1) obj[pair.slice(0, i).trim()] = parseScalar(pair.slice(i + 1));
    });
    return obj;
  }
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v === 'true' || v === 'false') return v === 'true';
  return v.replace(/\s+#.*$/, '');
}

function splitTop(s) {
  const out = [];
  let depth = 0, quote = null, cur = '';
  for (const ch of s) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function parseYaml(text) {
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.match(/^ */)[0].length;
    const m = line.trim().match(/^("[^"]+"|'[^']+'|[^:]+):(.*)$/);
    if (!m) continue;
    const key = m[1].replace(/^["']|["']$/g, '').trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;
    if (m[2].trim() === '') {
      parent[key] = {};
      stack.push({ indent, obj: parent[key] });
    } else {
      parent[key] = parseScalar(m[2]);
    }
  }
  return root;
}

function px(v) {
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  if (s.endsWith('rem') || s.endsWith('em')) return n * 16;
  return n;
}

function hexes(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj || {})) {
    const name = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object') hexes(v, name, out);
    else if (typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.trim())) out.push({ name: 'colors.' + name, hex: normHex(v) });
  }
  return out;
}

function normHex(h) {
  let s = h.trim().replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return '#' + s.slice(0, 6).toUpperCase();
}

function load(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) throw new Error(file + ' has no YAML front matter (--- ... ---). See github.com/google-labs-code/design.md');
  const y = parseYaml(m[1]);

  const colors = hexes(y.colors, '', []);
  const type = Object.entries(y.typography || {}).map(([name, t]) => ({
    name: 'typography.' + name,
    family: String(t.fontFamily || t.family || '').split(',')[0].replace(/["']/g, '').trim(),
    size: px(t.fontSize || t.size),
    weight: Number(t.fontWeight || t.weight) || null,
  }));
  const scale = (group, label) => Object.entries(y[group] || {})
    .map(([name, v]) => ({ name: label + '.' + name, px: px(v) }))
    .filter((t) => t.px !== null);
  const spacing = scale('spacing', 'spacing');
  const rounded = scale('rounded', 'rounded');

  return {
    name: y.name || 'DESIGN.md',
    colors,
    type,
    families: [...new Set(type.map((t) => t.family).filter(Boolean))],
    sizes: type.filter((t) => t.size),
    weights: [...new Set(type.map((t) => t.weight).filter(Boolean))],
    spacing,
    rounded,
    raw: y,
  };
}

module.exports = { load, parseYaml, normHex };
