import * as registrationService from '../services/registration.service.js';
import * as exportService from '../services/export.service.js';
import { validateRegistrationQuery } from '../validators/registration.validator.js';
import { parseId } from '../validators/validate.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

export async function register(req, res) {
  const registration = await registrationService.register(parseId(req.params.id), req.body?.formData, req.user);
  sendCreated(res, registration, 'Registered successfully');
}

export async function cancel(req, res) {
  const registration = await registrationService.cancel(parseId(req.params.id), req.user);
  sendSuccess(res, registration, 'Registration cancelled');
}

export async function listForWorkshop(req, res) {
  const filters = validateRegistrationQuery(req.query);
  sendSuccess(res, await registrationService.listForWorkshop(parseId(req.params.id), filters, req.user));
}

export async function myWorkshops(req, res) {
  sendSuccess(res, await registrationService.myWorkshops(req.user));
}

// GET /api/workshops/:id/registrations/export → .xlsx (organizer of the workshop or admin)
export async function exportForWorkshop(req, res) {
  exportService.sendWorkbook(res, await exportService.workshopParticipantsWorkbook(parseId(req.params.id), req.user));
}
