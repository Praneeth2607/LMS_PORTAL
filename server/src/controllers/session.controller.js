import * as sessionService from '../services/session.service.js';
import { validateCreateSession, validateUpdateSession } from '../validators/session.validator.js';
import { parseId } from '../validators/validate.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

export async function listForWorkshop(req, res) {
  sendSuccess(res, await sessionService.listSessions(parseId(req.params.id), req.user));
}

export async function create(req, res) {
  const session = await sessionService.createSession(parseId(req.params.id), validateCreateSession(req.body), req.user);
  sendCreated(res, session, 'Session created');
}

export async function get(req, res) {
  sendSuccess(res, await sessionService.getSession(parseId(req.params.id), req.user));
}

export async function update(req, res) {
  const session = await sessionService.updateSession(parseId(req.params.id), validateUpdateSession(req.body), req.user);
  sendSuccess(res, session, 'Session updated');
}

export async function remove(req, res) {
  await sessionService.deleteSession(parseId(req.params.id), req.user);
  sendSuccess(res, null, 'Session deleted');
}
