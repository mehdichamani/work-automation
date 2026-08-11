const path = require('path');

function toSnake(key) {
  return String(key).replace(/([A-Z])/g, (m) => '_' + m.toLowerCase());
}

function fmtDate(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return d;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// Converts Prisma camelCase row(s) back to snake_case to preserve the old API contract
function mapRow(row) {
  if (row === null || row === undefined) return row;
  if (Array.isArray(row)) return row.map(mapRow);
  if (typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    let val = v;
    if (typeof v === 'boolean') val = v ? 1 : 0;
    else if (v instanceof Date) val = fmtDate(v);
    else if (Array.isArray(v)) val = v.map((i) => (i && typeof i === 'object' ? mapRow(i) : i));
    else if (v && typeof v === 'object') val = mapRow(v);
    out[toSnake(k)] = val;
  }
  return out;
}

// Flattens a Prisma include result into the flat "alias" shape the old SQL JOINs produced.
// e.g. flattenJoins({...row, user: {fullName}}, { user_name: 'user.fullName' })
// Only the nested objects referenced by alias root keys are removed.
function flattenJoins(row, aliases) {
  const out = { ...row };
  const rootsToRemove = new Set();
  for (const [alias, nestedPath] of Object.entries(aliases)) {
    const parts = nestedPath.split('.');
    rootsToRemove.add(parts[0]);
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] === null || cur[parts[i]] === undefined) break;
      cur = cur[parts[i]];
    }
    const lastKey = parts[parts.length - 1];
    out[alias] = cur && cur[lastKey] !== undefined ? cur[lastKey] : null;
  }
  for (const key of rootsToRemove) {
    if (key in out) delete out[key];
  }
  return out;
}

module.exports = { toSnake, mapRow, flattenJoins };
