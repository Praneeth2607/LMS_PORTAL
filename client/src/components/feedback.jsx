// Feedback building blocks: the 5-point agreement scale (input) and the
// aggregated result displays shown to organizers and admins.

// Diverging colours from the design tokens: dark = agree, orange = disagree.
export const SCALE_STYLES = {
  5: 'bg-ink',
  4: 'bg-slate',
  3: 'bg-dust',
  2: 'bg-signal-light',
  1: 'bg-clay',
};

// One Likert question as an accessible radio group.
export function LikertQuestion({ index, question, scale, value, onChange, error }) {
  const name = `q-${question.id}`;
  return (
    <fieldset className="border-t rule pt-6" aria-invalid={error ? true : undefined}>
      <legend className="float-left w-full text-[18px] font-medium tracking-[-0.01em]">
        <span className="mr-2 text-slate">{String(index + 1).padStart(2, '0')}</span>
        {question.text}
      </legend>
      <div className="clear-both grid gap-2 pt-4 sm:grid-cols-5">
        {scale.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-full border px-4 py-2 text-[15px] font-medium transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink sm:justify-center sm:px-2 sm:text-center ${
                checked ? 'border-ink bg-ink text-canvas' : 'border-ink/25 bg-white text-ink hover:border-ink'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full sm:hidden ${SCALE_STYLES[option.value]}`} aria-hidden="true" />
              {option.label}
            </label>
          );
        })}
      </div>
      {error && <p className="mt-2 text-[14px] font-medium text-clay">{error}</p>}
    </fieldset>
  );
}

export const formatScore = (value) => (value === null || value === undefined ? '–' : value.toFixed(1));

// Stacked bar of how many chose each option (widths are shares of responses).
export function Distribution({ counts, scale, label }) {
  const total = scale.reduce((sum, o) => sum + (counts[o.value] || 0), 0);
  const summary = scale.map((o) => `${o.label}: ${counts[o.value] || 0}`).join(', ');
  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-ghost"
        role="img"
        aria-label={`${label}. ${total ? summary : 'No responses yet'}`}
      >
        {total > 0 &&
          scale.map((o) =>
            counts[o.value] ? (
              <span
                key={o.value}
                className={`h-full ${SCALE_STYLES[o.value]}`}
                style={{ width: `${(counts[o.value] * 100) / total}%` }}
                title={`${o.label}: ${counts[o.value]}`}
              />
            ) : null,
          )}
      </div>
    </div>
  );
}

export function ScaleLegend({ scale }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-slate">
      {scale.map((o) => (
        <li key={o.value} className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${SCALE_STYLES[o.value]}`} aria-hidden="true" />
          {o.label} ({o.value})
        </li>
      ))}
    </ul>
  );
}
