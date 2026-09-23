import * as authService from '../services/auth.service.js';
import * as organizerRequestService from '../services/organizerRequest.service.js';
import { validateLogin, validateOrganizerRequest, validateRegister } from '../validators/auth.validator.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

export async function register(req, res) {
  const result = await authService.register(validateRegister(req.body));
  sendCreated(res, result, 'Registration successful');
}

export async function login(req, res) {
  const result = await authService.login(validateLogin(req.body));
  sendSuccess(res, result, 'Login successful');
}

export async function requestOrganizerAccess(req, res) {
  const request = await organizerRequestService.submitRequest(validateOrganizerRequest(req.body));
  sendCreated(res, request, 'Request sent. You can sign in once an admin approves it.');
}

export async function me(req, res) {
  sendSuccess(res, req.user);
}
