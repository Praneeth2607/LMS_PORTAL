import { useId } from 'react';

// Labelled field wrapper with hint + error, wired for screen readers.
// `children` is a render function receiving the control's a11y props.
export function Field({ label, required, hint, error, children, className = '' }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
    required,
  };
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {required && (
          <span className="ml-1 text-signal" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children(control)}
      {hint && (
        <p id={hintId} className="mt-2 text-[14px] text-slate">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-2 text-[14px] font-medium text-clay">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({ label, required, hint, error, className, ...inputProps }) {
  return (
    <Field label={label} required={required} hint={hint} error={error} className={className}>
      {(control) => <input className="input" {...control} {...inputProps} />}
    </Field>
  );
}

export function TextAreaField({ label, required, hint, error, className, ...props }) {
  return (
    <Field label={label} required={required} hint={hint} error={error} className={className}>
      {(control) => <textarea className="input" {...control} {...props} />}
    </Field>
  );
}

export function SelectField({ label, required, hint, error, className, options, placeholder, ...props }) {
  return (
    <Field label={label} required={required} hint={hint} error={error} className={className}>
      {(control) => (
        <select className="input" {...control} {...props}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => {
            const { value, label: text } = typeof option === 'string' ? { value: option, label: option } : option;
            return (
              <option key={value} value={value}>
                {text}
              </option>
            );
          })}
        </select>
      )}
    </Field>
  );
}

export function CheckboxField({ label, required, error, hint, checked, onChange, className = '' }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        />
        <span className="font-medium">
          {label}
          {required && (
            <span className="ml-1 text-signal" aria-hidden="true">
              *
            </span>
          )}
          {required && <span className="sr-only"> (required)</span>}
        </span>
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[14px] text-slate">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-[14px] font-medium text-clay">
          {error}
        </p>
      )}
    </div>
  );
}

// Turns ApiError.errors ([{ field, message }]) into { field: message }.
export function fieldErrors(error) {
  const map = {};
  for (const item of error?.errors || []) {
    if (item.field && !map[item.field]) map[item.field] = item.message;
  }
  return map;
}
