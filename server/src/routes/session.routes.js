import { Router } from 'express';
import * as sessionController from '../controllers/session.controller.js';
import * as attendanceController from '../controllers/attendance.controller.js';
import { authenticate, authorize, optionalAuthenticate } from '../middleware/auth.js';

// Mounted at /api/sessions.
const router = Router();
const manager = [authenticate, authorize('ORGANIZER', 'ADMIN')];

router.get('/:id', optionalAuthenticate, sessionController.get);
router.put('/:id', ...manager, sessionController.update);
router.delete('/:id', ...manager, sessionController.remove);

router.post('/:id/attendance/start', ...manager, attendanceController.start);
router.post('/:id/attendance/stop', ...manager, attendanceController.stop);
router.post('/:id/attendance/manual', ...manager, attendanceController.manual);
router.post('/:id/attendance/mark', authenticate, authorize('PARTICIPANT'), attendanceController.mark);

export default router;
