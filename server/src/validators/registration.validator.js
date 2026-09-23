import { badRequest } from '../utils/httpError.js';
import { validate } from './validate.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{6,17}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function checkAnswer(field, raw) {
  const text = typeof raw === 'string' ? raw.trim() : raw;
  switch (field.fieldType) {
    case 'CHECKBOX':
      if (raw === true || raw === 'true') return { value: true };
      if (raw === false || raw === 'false') return { value: false };
      return { error: 'must be true or false' };
    case 'NUMBER': {
      const num = typeof text === 'string' ? Number(text) : text;
      return Number.isFinite(num) ? { value: num } : { error: 'must be a number' };
    }
    case 'EMAIL':
      return typeof text === 'string' && EMAIL_RE.test(text)
        ? { value: text.toLowerCase() }
        : { error: 'must be a valid email' };
    case 'PHONE':
      return typeof text === 'string' && PHONE_RE.test(text) ? { value: text } : { error: 'must be a valid phone number' };
    case 'DATE':
      return typeof text === 'string' && DATE_RE.test(text) ? { value: text } : { error: 'must be a date (YYYY-MM-DD)' };
    case 'SELECT':
      return field.options?.includes(String(text))
        ? { value: String(text) }
        : { error: `must be one of: ${field.options?.join(', ')}` };
    case 'TEXTAREA':
      return typeof text === 'string' && text.length <= 2000
        ? { value: text }
        : { error: 'must be text (max 2000 characters)' };
    default: // TEXT
      return typeof text === 'string' && text.length <= 500
        ? { value: text }
        : { error: 'must be text (max 500 characters)' };
  }
}

// Validates answers against the workshop's registration_fields. Unknown keys
// are dropped, so form_data only ever contains configured fields.
export function validateFormData(fields, formData = {}) {
  if (formData === null || typeof formData !== 'object' || Array.isArray(formData)) {
    throw badRequest('formData must be an object');
  }

  const clean = {};
  const errors = [];
  for (const field of fields) {
    const raw = formData[field.fieldName];
    const blank = raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');

    if (blank) {
      if (field.required) errors.push({ field: field.fieldName, message: `${field.fieldName} is required` });
      continue;
    }
    const result = checkAnswer(field, raw);
    if (result.error) {
      errors.push({ field: field.fieldName, message: `${field.fieldName} ${result.error}` });
    } else if (field.fieldType === 'CHECKBOX' && field.required && result.value !== true) {
      errors.push({ field: field.fieldName, message: `${field.fieldName} must be checked` });
    } else {
      clean[field.fieldName] = result.value;
    }
  }

  if (errors.length) throw badRequest('Validation failed', errors);
  return clean;
}

export const validateRegistrationQuery = (queryParams) =>
  validate(queryParams, { status: { type: 'enum', values: ['REGISTERED', 'CANCELLED'] } });
