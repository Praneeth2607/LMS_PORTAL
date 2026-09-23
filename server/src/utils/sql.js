// Builds "col1 = $1, col2 = $2" from the keys present in `data`, mapping
// camelCase field names to column names via `columns`.
export function buildSetClause(data, columns, startIndex = 1) {
  const sets = [];
  const values = [];
  for (const [field, column] of Object.entries(columns)) {
    if (data[field] === undefined) continue;
    values.push(data[field]);
    sets.push(`${column} = $${startIndex + values.length - 1}`);
  }
  return { sets: sets.join(', '), values };
}
