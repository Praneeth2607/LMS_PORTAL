import * as workshopService from '../services/workshop.service.js';
import {
  validateCreateWorkshop,
  validateUpdateWorkshop,
  validateWorkshopQuery,
} from '../validators/workshop.validator.js';
import { parseId } from '../validators/validate.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

export async function list(req, res) {
  const filters = validateWorkshopQuery(req.query);
  sendSuccess(res, await workshopService.listWorkshops(filters, req.user));
}

export async function get(req, res) {
  sendSuccess(res, await workshopService.getWorkshop(parseId(req.params.id), req.user));
}

export async function create(req, res) {
  const workshop = await workshopService.createWorkshop(validateCreateWorkshop(req.body), req.user);
  sendCreated(res, workshop, 'Workshop created as draft');
}

export async function update(req, res) {
  const data = validateUpdateWorkshop(req.body);
  sendSuccess(res, await workshopService.updateWorkshop(parseId(req.params.id), data, req.user), 'Workshop updated');
}

export async function remove(req, res) {
  await workshopService.deleteWorkshop(parseId(req.params.id), req.user);
  sendSuccess(res, null, 'Workshop deleted');
}

export async function publish(req, res) {
  sendSuccess(res, await workshopService.publishWorkshop(parseId(req.params.id), req.user), 'Workshop published');
}

export async function close(req, res) {
  sendSuccess(res, await workshopService.closeWorkshop(parseId(req.params.id), req.user), 'Workshop closed');
}
