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

// SQL condition: session `alias` has finished (its end time, read in the
// timezone held by placeholder `tz`, is in the past by the DB clock).
// Attendance percentages only count finished sessions.
export const sessionEnded = (alias, tz) => `((${alias}.session_date + ${alias}.end_time) AT TIME ZONE ${tz}) <= NOW()`;
