import { badRequest } from '../utils/httpError.js';

// Minimal declarative validator. A schema maps field names to rules:
//   { type, required, label, max, min, values, default }
// types: string | email | password | int | boolean | date | time | enum | url | custom
// `custom` rules provide check(value) => { value } | { error }.
//
// Returns only the fields that were provided (plus defaults when not partial),
// trimmed and normalised. Throws a 400 with an `errors` array on failure.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

const isBlank = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

function checkValue(value, rule, label) {
  switch (rule.type) {
    case 'string': {
      if (typeof value !== 'string') return { error: `${label} must be text` };
      const trimmed = value.trim();
      if (rule.min && trimmed.length < rule.min) return { error: `${label} must be at least ${rule.min} characters` };
      if (rule.max && trimmed.length > rule.max) return { error: `${label} must be at most ${rule.max} characters` };
      return { value: trimmed };
    }
    case 'password': {
      if (typeof value !== 'string') return { error: `${label} must be text` };
      if (value.length < 8) return { error: `${label} must be at least 8 characters` };
      if (value.length > 72) return { error: `${label} must be at most 72 characters` };
      return { value };
    }
    case 'email': {
      const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
      if (!EMAIL_RE.test(email) || email.length > 255) return { error: `${label} must be a valid email address` };
      return { value: email };
    }
    case 'int': {
      const num = typeof value === 'string' ? Number(value.trim()) : value;
      if (!Number.isInteger(num)) return { error: `${label} must be a whole number` };
      if (rule.min !== undefined && num < rule.min) return { error: `${label} must be at least ${rule.min}` };
      if (rule.max !== undefined && num > rule.max) return { error: `${label} must be at most ${rule.max}` };
      return { value: num };
    }
    case 'boolean': {
      if (value === true || value === 'true') return { value: true };
      if (value === false || value === 'false') return { value: false };
      return { error: `${label} must be true or false` };
    }
    case 'date': {
      if (typeof value !== 'string' || !DATE_RE.test(value.trim())) return { error: `${label} must be a date (YYYY-MM-DD)` };
      const date = new Date(`${value.trim()}T00:00:00Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value.trim()) {
        return { error: `${label} is not a valid date` };
      }
      return { value: value.trim() };
    }
    case 'time': {
      const match = typeof value === 'string' ? value.trim().match(TIME_RE) : null;
      if (!match) return { error: `${label} must be a time (HH:MM)` };
      return { value: `${match[1]}:${match[2]}` };
    }
    case 'enum': {
      const upper = typeof value === 'string' ? value.trim().toUpperCase() : value;
      if (!rule.values.includes(upper)) return { error: `${label} must be one of: ${rule.values.join(', ')}` };
      return { value: upper };
    }
    case 'url': {
      try {
        const url = new URL(String(value).trim());
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
        return { value: url.toString() };
      } catch {
        return { error: `${label} must be a valid http(s) URL` };
      }
    }
    case 'custom':
      return rule.check(value);
    default:
      throw new Error(`Unknown validation type: ${rule.type}`);
  }
}

export function validate(input, schema, { partial = false } = {}) {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const data = {};
  const errors = [];

  for (const [field, rule] of Object.entries(schema)) {
    const label = rule.label || field;
    const value = body[field];

    if (isBlank(value)) {
      if (rule.required && (!partial || field in body)) {
        errors.push({ field, message: `${label} is required` });
      } else if (!partial && 'default' in rule) {
        data[field] = rule.default;
      } else if (field in body) {
        data[field] = null; // explicitly cleared optional field
      }
      continue;
    }

    const result = checkValue(value, rule, label);
    if (result.error) errors.push({ field, message: result.error });
    else data[field] = result.value;
  }

  if (errors.length) throw badRequest('Validation failed', errors);
  return data;
}

// Validates a positive integer route parameter such as :id.
export function parseId(value, label = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
    throw badRequest(`Invalid ${label}`);
  }
  return id;
}
