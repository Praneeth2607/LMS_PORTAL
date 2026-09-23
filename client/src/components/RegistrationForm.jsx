import { useState } from 'react';
import { CheckboxField, Field, fieldErrors } from './Form.jsx';
import { Notice, Spinner } from './ui.jsx';
import { useAction } from '../hooks/useUtils.js';
import { registerForWorkshop } from '../services/registrationService.js';

const INPUT_TYPES = { TEXT: 'text', EMAIL: 'email', PHONE: 'tel', NUMBER: 'number', DATE: 'date' };
const AUTOCOMPLETE = { EMAIL: 'email', PHONE: 'tel' };

// Renders the workshop's configured registrationFields (from the API) and
// submits them as formData keyed by fieldName. Validation is the backend's;
// its per-field errors are shown next to each input.
export default function RegistrationForm({ workshop, onRegistered }) {
  const fields = [...(workshop.registrationFields || [])].sort((a, b) => a.fieldOrder - b.fieldOrder);
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.fieldName, f.fieldType === 'CHECKBOX' ? false : ''])),
  );
  const { pending, error, run } = useAction();
  const errors = fieldErrors(error);

  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const result = await run(() => registerForWorkshop(workshop.id, values));
    if (result.ok) onRegistered?.(result.data);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {fields.length === 0 && (
        <p className="text-charcoal">No extra details are needed. Confirm to reserve your seat.</p>
      )}

      {fields.map((field) => {
        const name = field.fieldName;
        const errorText = errors[name];
        if (field.fieldType === 'CHECKBOX') {
          return (
            <CheckboxField
              key={field.id}
              label={name}
              required={field.required}
              checked={values[name]}
              onChange={(checked) => set(name, checked)}
              error={errorText}
            />
          );
        }
        return (
          <Field key={field.id} label={name} required={field.required} error={errorText}>
            {(control) => {
              if (field.fieldType === 'TEXTAREA') {
                return (
                  <textarea className="input" {...control} value={values[name]} onChange={(e) => set(name, e.target.value)} />
                );
              }
              if (field.fieldType === 'SELECT') {
                return (
                  <select className="input" {...control} value={values[name]} onChange={(e) => set(name, e.target.value)}>
                    <option value="">Choose…</option>
                    {(field.options || []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                );
              }
              return (
                <input
                  className="input"
                  type={INPUT_TYPES[field.fieldType] || 'text'}
                  autoComplete={AUTOCOMPLETE[field.fieldType]}
                  inputMode={field.fieldType === 'NUMBER' ? 'decimal' : undefined}
                  {...control}
                  value={values[name]}
                  onChange={(e) => set(name, e.target.value)}
                />
              );
            }}
          </Field>
        );
      })}

      {error && !Object.keys(errors).length && <Notice tone="error">{error.message}</Notice>}
      {error && Object.keys(errors).length > 0 && (
        <Notice tone="error">Please fix the highlighted fields and try again.</Notice>
      )}

      <p className="text-[14px] text-slate">
        Fields marked <span className="text-signal">*</span> are required.
      </p>
      <button type="submit" className="btn btn-primary btn-lg w-full sm:w-auto" disabled={pending}>
        {pending && <Spinner />}
        {pending ? 'Registering…' : 'Register for this workshop'}
      </button>
    </form>
  );
}
