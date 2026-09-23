import * as authService from '../services/auth.service.js';
import { validateLogin, validateRegister } from '../validators/auth.validator.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

export async function register(req, res) {
  const result = await authService.register(validateRegister(req.body));
  sendCreated(res, result, 'Registration successful');
}

export async function login(req, res) {
  const result = await authService.login(validateLogin(req.body));
  sendSuccess(res, result, 'Login successful');
}

export async function me(req, res) {
  sendSuccess(res, req.user);
}
