import * as attendanceService from '../services/attendance.service.js';
import {
  validateManualAttendance,
  validateMarkAttendance,
  validateStartAttendance,
} from '../validators/session.validator.js';
import { parseId } from '../validators/validate.js';
import { sendSuccess } from '../utils/response.js';

export async function start(req, res) {
  const result = await attendanceService.startAttendance(
    parseId(req.params.id),
    validateStartAttendance(req.body),
    req.user,
  );
  sendSuccess(res, result, 'Attendance started');
}

export async function stop(req, res) {
  sendSuccess(res, await attendanceService.stopAttendance(parseId(req.params.id), req.user), 'Attendance stopped');
}

export async function mark(req, res) {
  const result = await attendanceService.markAttendance(parseId(req.params.id), validateMarkAttendance(req.body), req.user);
  sendSuccess(res, result, 'Attendance marked');
}

export async function manual(req, res) {
  const result = await attendanceService.setManualAttendance(
    parseId(req.params.id),
    validateManualAttendance(req.body),
    req.user,
  );
  sendSuccess(res, result, 'Attendance updated');
}

export async function workshopAttendance(req, res) {
  sendSuccess(res, await attendanceService.getWorkshopAttendance(parseId(req.params.id), req.user));
}

export async function workshopSummary(req, res) {
  sendSuccess(res, await attendanceService.getAttendanceSummary(parseId(req.params.id), req.user));
}
