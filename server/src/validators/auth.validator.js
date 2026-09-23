import { validate } from './validate.js';

export const validateRegister = (body) =>
  validate(body, {
    name: { type: 'string', required: true, label: 'Name', min: 2, max: 120 },
    email: { type: 'email', required: true, label: 'Email' },
    password: { type: 'password', required: true, label: 'Password' },
  });

export const validateLogin = (body) =>
  validate(body, {
    email: { type: 'email', required: true, label: 'Email' },
    password: { type: 'string', required: true, label: 'Password' },
  });
