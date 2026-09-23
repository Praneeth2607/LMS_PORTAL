import { useState } from 'react';
import { CheckboxField, SelectField, TextAreaField, TextField, fieldErrors } from './Form.jsx';
import { Notice, Spinner } from './ui.jsx';
import Icon from './Icon.jsx';
import { useAction } from '../hooks/useUtils.js';

// Field types supported by the backend (docs/API.md → Enums).
const FIELD_TYPES = [
  { value: 'TEXT', label: 'Short text' },
  { value: 'TEXTAREA', label: 'Long text' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'DATE', label: 'Date' },
  { value: 'SELECT', label: 'Dropdown' },
  { value: 'CHECKBOX', label: 'Checkbox' },
];

const MODES = [
  { value: 'OFFLINE', label: 'In person' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'HYBRID', label: 'Hybrid' },
];

let rowKey = 0;
const toRow = (f) => ({
  key: ++rowKey,
  fieldName: f.fieldName || '',
  fieldType: f.fieldType || 'TEXT',
  required: Boolean(f.required),
  optionsText: (f.options || []).join(', '),
});

function RegistrationFieldsEditor({ rows, setRows, error }) {
  const update = (key, patch) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (index, delta) =>
    setRows((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });

  return (
    <fieldset>
      <legend className="card-title">Registration form</legend>
      <p className="mt-2 text-charcoal">
        Choose what participants fill in when they register. Name and email come from their account automatically.
      </p>

      {rows.length > 0 && (
        <ol className="mt-6 space-y-4">
          {rows.map((row, index) => (
            <li key={row.key} className="rounded-[28px] bg-white p-5 md:p-6">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-end">
                <TextField
                  label={`Field ${index + 1} label`}
                  value={row.fieldName}
                  maxLength={100}
                  required
                  placeholder="e.g. Roll Number"
                  onChange={(e) => update(row.key, { fieldName: e.target.value })}
                />
                <SelectField
                  label="Type"
                  value={row.fieldType}
                  options={FIELD_TYPES}
                  onChange={(e) => update(row.key, { fieldType: e.target.value })}
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="btn btn-quiet btn-icon"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move field ${index + 1} up`}
                  >
                    <Icon name="chevronUp" size={18} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-quiet btn-icon"
                    onClick={() => move(index, 1)}
                    disabled={index === rows.length - 1}
                    aria-label={`Move field ${index + 1} down`}
                  >
                    <Icon name="chevronDown" size={18} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-quiet btn-icon text-clay"
                    onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                    aria-label={`Remove field ${index + 1}`}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              </div>
              {row.fieldType === 'SELECT' && (
                <TextField
                  className="mt-4"
                  label="Options"
                  hint="Separate options with commas, e.g. 1, 2, 3, 4"
                  value={row.optionsText}
                  required
                  onChange={(e) => update(row.key, { optionsText: e.target.value })}
                />
              )}
              <CheckboxField
                className="mt-3"
                label="Required"
                checked={row.required}
                onChange={(checked) => update(row.key, { required: checked })}
              />
            </li>
          ))}
        </ol>
      )}

      {error && <p className="mt-4 text-[14px] font-medium text-clay">{error}</p>}

      <button
        type="button"
        className="btn btn-secondary mt-6"
        onClick={() => setRows((list) => [...list, toRow({})])}
        disabled={rows.length >= 20}
      >
        <Icon name="plus" size={18} /> Add a field
      </button>
    </fieldset>
  );
}

// Create / edit form. `initial` is a workshop from the API (edit) or undefined (create).
// onSubmit(payload) must return a promise; backend validation errors are mapped to fields.
export default function WorkshopForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [values, setValues] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    startDate: initial?.startDate || '',
    endDate: initial?.endDate || '',
    mode: initial?.mode || 'OFFLINE',
    venue: initial?.venue || '',
    meetingLink: initial?.meetingLink || '',
    capacity: initial?.capacity ?? '',
  });
  const [rows, setRows] = useState(() => (initial?.registrationFields || []).map(toRow));
  const { pending, error, run } = useAction();
  const errors = fieldErrors(error);

  const bind = (name) => ({
    value: values[name],
    onChange: (e) => setValues((v) => ({ ...v, [name]: e.target.value })),
    error: errors[name],
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...values,
      capacity: values.capacity === '' ? null : Number(values.capacity),
      registrationFields: rows.map((row, index) => ({
        fieldName: row.fieldName.trim(),
        fieldType: row.fieldType,
        required: row.required,
        fieldOrder: index + 1,
        ...(row.fieldType === 'SELECT' && {
          options: row.optionsText
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean),
        }),
      })),
    };
    await run(() => onSubmit(payload));
  };

  const needsVenue = values.mode !== 'ONLINE';
  const needsLink = values.mode !== 'OFFLINE';

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-12">
      <section className="panel space-y-6" aria-labelledby="basics-title">
        <h2 id="basics-title" className="card-title">
          Basics
        </h2>
        <TextField label="Title" required maxLength={200} {...bind('title')} />
        <TextAreaField
          label="Description"
          maxLength={5000}
          hint="What participants will learn and what to bring."
          {...bind('description')}
        />
        <div className="grid gap-6 md:grid-cols-2">
          <TextField label="Start date" type="date" required {...bind('startDate')} />
          <TextField label="End date" type="date" required min={values.startDate || undefined} {...bind('endDate')} />
        </div>
        <TextField
          label="Capacity"
          type="number"
          min={1}
          inputMode="numeric"
          hint="Leave empty for unlimited seats."
          {...bind('capacity')}
        />
      </section>

      <section className="panel space-y-6" aria-labelledby="place-title">
        <h2 id="place-title" className="card-title">
          Where it happens
        </h2>
        <SelectField label="Mode" options={MODES} {...bind('mode')} />
        {needsVenue && (
          <TextField
            label="Venue"
            maxLength={255}
            hint="Required before an in-person or hybrid workshop can be published."
            {...bind('venue')}
          />
        )}
        {needsLink && (
          <TextField
            label="Meeting link"
            type="url"
            placeholder="https://"
            hint="Optional backup link. Online sessions run live inside the portal, where attendance is tracked automatically."
            {...bind('meetingLink')}
          />
        )}
      </section>

      <section className="panel">
        <RegistrationFieldsEditor rows={rows} setRows={setRows} error={errors.registrationFields} />
      </section>

      {error && (
        <Notice tone="error">
          {Object.keys(errors).length ? 'Please fix the highlighted fields.' : error.message}
        </Notice>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
          {pending && <Spinner />}
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary btn-lg" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
