import * as adminService from '../services/admin.service.js';
import { parseId, validate } from '../validators/validate.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

const ROLES = ['ADMIN', 'ORGANIZER', 'PARTICIPANT'];

export async function stats(req, res) {
  sendSuccess(res, await adminService.getStats());
}

export async function listUsers(req, res) {
  const filters = validate(req.query, {
    role: { type: 'enum', values: ROLES },
    search: { type: 'string', max: 100 },
  });
  sendSuccess(res, await adminService.listUsers(filters));
}

export async function createUser(req, res) {
  const data = validate(req.body, {
    name: { type: 'string', required: true, label: 'Name', min: 2, max: 120 },
    email: { type: 'email', required: true, label: 'Email' },
    password: { type: 'password', required: true, label: 'Password' },
    role: { type: 'enum', required: true, label: 'Role', values: ROLES },
  });
  sendCreated(res, await adminService.createUserAccount(data), 'User created');
}

export async function suspend(req, res) {
  sendSuccess(res, await adminService.suspendUser(parseId(req.params.id), req.user), 'User suspended');
}

export async function reactivate(req, res) {
  sendSuccess(res, await adminService.reactivateUser(parseId(req.params.id), req.user), 'User reactivated');
}

export async function remove(req, res) {
  const result = await adminService.deleteUser(parseId(req.params.id), req.user);
  sendSuccess(res, result, result.emailBlocked ? 'User deleted. Their email is blocked from signing up again.' : 'User deleted');
}
