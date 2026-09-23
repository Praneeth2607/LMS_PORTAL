import { validate } from './validate.js';

export const WORKSHOP_MODES = ['ONLINE', 'OFFLINE', 'HYBRID'];
export const WORKSHOP_STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED'];
export const FIELD_TYPES = ['TEXT', 'TEXTAREA', 'EMAIL', 'PHONE', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX'];

// registrationFields: [{ fieldName, fieldType, required, fieldOrder, options }]
function checkRegistrationFields(value) {
  if (!Array.isArray(value)) return { error: 'registrationFields must be an array' };
  if (value.length > 20) return { error: 'A workshop can have at most 20 registration fields' };

  const seen = new Set();
  const fields = [];
  for (const [index, raw] of value.entries()) {
    const position = `registrationFields[${index}]`;
    if (!raw || typeof raw !== 'object') return { error: `${position} must be an object` };

    const fieldName = typeof raw.fieldName === 'string' ? raw.fieldName.trim() : '';
    if (!fieldName || fieldName.length > 100) {
      return { error: `${position}.fieldName is required (max 100 characters)` };
    }
    if (seen.has(fieldName.toLowerCase())) return { error: `Duplicate registration field "${fieldName}"` };
    seen.add(fieldName.toLowerCase());

    const fieldType = String(raw.fieldType || 'TEXT').toUpperCase();
    if (!FIELD_TYPES.includes(fieldType)) {
      return { error: `${position}.fieldType must be one of: ${FIELD_TYPES.join(', ')}` };
    }

    let options = null;
    if (fieldType === 'SELECT') {
      const valid =
        Array.isArray(raw.options) &&
        raw.options.length > 0 &&
        raw.options.every((o) => typeof o === 'string' && o.trim());
      if (!valid) return { error: `${position}.options must be a non-empty array of strings for SELECT fields` };
      options = [...new Set(raw.options.map((o) => o.trim()))];
    }

    const fieldOrder = Number.isInteger(raw.fieldOrder) ? raw.fieldOrder : index + 1;
    fields.push({ fieldName, fieldType, required: raw.required === true, fieldOrder, options });
  }
  return { value: fields };
}

const workshopSchema = {
  title: { type: 'string', required: true, label: 'Title', max: 200 },
  description: { type: 'string', label: 'Description', max: 5000 },
  startDate: { type: 'date', required: true, label: 'Start date' },
  endDate: { type: 'date', required: true, label: 'End date' },
  mode: { type: 'enum', values: WORKSHOP_MODES, label: 'Mode', default: 'OFFLINE' },
  venue: { type: 'string', label: 'Venue', max: 255 },
  meetingLink: { type: 'url', label: 'Meeting link' },
  capacity: { type: 'int', label: 'Capacity', min: 1, max: 100000 },
  registrationFields: { type: 'custom', check: checkRegistrationFields },
};

export const validateCreateWorkshop = (body) => validate(body, workshopSchema);
export const validateUpdateWorkshop = (body) => validate(body, workshopSchema, { partial: true });

export const validateWorkshopQuery = (queryParams) =>
  validate(queryParams, {
    search: { type: 'string', max: 100 },
    status: { type: 'enum', values: WORKSHOP_STATUSES },
    mode: { type: 'enum', values: WORKSHOP_MODES },
    mine: { type: 'boolean' },
  });
