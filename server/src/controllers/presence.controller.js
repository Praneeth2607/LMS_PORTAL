import * as presenceService from '../services/presence.service.js';
import { parseId } from '../validators/validate.js';
import { sendSuccess } from '../utils/response.js';

export async function join(req, res) {
  sendSuccess(res, await presenceService.joinVideo(parseId(req.params.id), req.user));
}

export async function heartbeat(req, res) {
  sendSuccess(res, await presenceService.heartbeat(parseId(req.params.id), req.user));
}

export async function status(req, res) {
  sendSuccess(res, await presenceService.getStatus(parseId(req.params.id), req.user));
}

export async function participants(req, res) {
  sendSuccess(res, await presenceService.listParticipants(parseId(req.params.id), req.user));
}
