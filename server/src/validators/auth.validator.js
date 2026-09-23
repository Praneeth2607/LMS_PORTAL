import { validate } from './validate.js';

export const validateRegister = (body) =>
  validate(body, {
    name: { type: 'string', required: true, label: 'Name', min: 2, max: 120 },
    email: { type: 'email', required: true, label: 'Email' },
    password: { type: 'password', required: true, label: 'Password' },
  });

export const validateOrganizerRequest = (body) =>
  validate(body, {
    name: { type: 'string', required: true, label: 'Name', min: 2, max: 120 },
    email: { type: 'email', required: true, label: 'Email' },
    password: { type: 'password', required: true, label: 'Password' },
    designation: { type: 'string', required: true, label: 'Designation', min: 2, max: 120 },
    reason: { type: 'string', required: true, label: 'Reason', min: 10, max: 1000 },
  });

export const validateLogin = (body) =>
  validate(body, {
    email: { type: 'email', required: true, label: 'Email' },
    password: { type: 'string', required: true, label: 'Password' },
    // Which sign-in tab was used; when sent, the account's role must match it.
    portal: { type: 'enum', label: 'Portal', values: ['PARTICIPANT', 'ORGANIZER'] },
  });
