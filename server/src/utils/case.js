// Converts a DB row's snake_case keys to camelCase (top level only, so JSONB
// values such as form_data keep their original keys).
const toCamel = (key) => key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

export const camelize = (row) => {
  if (!row) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) out[toCamel(key)] = value;
  return out;
};

export const camelizeRows = (rows) => rows.map(camelize);
