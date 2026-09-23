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

export async function changeRole(req, res) {
  const { role } = validate(req.body, { role: { type: 'enum', required: true, label: 'Role', values: ROLES } });
  sendSuccess(res, await adminService.changeRole(parseId(req.params.id), role, req.user), 'Role updated');
}
