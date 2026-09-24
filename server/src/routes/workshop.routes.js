import { Router } from 'express';
import * as workshopController from '../controllers/workshop.controller.js';
import * as registrationController from '../controllers/registration.controller.js';
import * as sessionController from '../controllers/session.controller.js';
import * as attendanceController from '../controllers/attendance.controller.js';
import * as certificateController from '../controllers/certificate.controller.js';
import * as announcementController from '../controllers/announcement.controller.js';
import * as feedbackController from '../controllers/feedback.controller.js';
import { authenticate, authorize, optionalAuthenticate } from '../middleware/auth.js';

// Mounted at /api/workshops. Ownership (organizer of THIS workshop) is checked
// in the services; the routes only check the role.
const router = Router();
const manager = [authenticate, authorize('ORGANIZER', 'ADMIN')];
const participant = [authenticate, authorize('PARTICIPANT')];

// Workshops
router.get('/', optionalAuthenticate, workshopController.list);
router.post('/', ...manager, workshopController.create);
router.get('/:id', optionalAuthenticate, workshopController.get);
router.put('/:id', ...manager, workshopController.update);
router.delete('/:id', ...manager, workshopController.remove);
router.patch('/:id/publish', ...manager, workshopController.publish);
router.patch('/:id/close', ...manager, workshopController.close);

// Registrations
router.post('/:id/register', ...participant, registrationController.register);
router.delete('/:id/register', ...participant, registrationController.cancel);
router.get('/:id/registrations', ...manager, registrationController.listForWorkshop);
router.get('/:id/registrations/export', ...manager, registrationController.exportForWorkshop);

// Sessions
router.get('/:id/sessions', optionalAuthenticate, sessionController.listForWorkshop);
router.post('/:id/sessions', ...manager, sessionController.create);

// Attendance reports
router.get('/:id/attendance', ...manager, attendanceController.workshopAttendance);
router.get('/:id/attendance/summary', ...manager, attendanceController.workshopSummary);

// Certificates
router.post('/:id/certificates/generate', ...manager, certificateController.generate);
router.get('/:id/certificates', ...manager, certificateController.listForWorkshop);

// Announcements
router.get('/:id/announcements', optionalAuthenticate, announcementController.list);
router.post('/:id/announcements', ...manager, announcementController.create);

// Session feedback (questions + aggregated results)
router.get('/:id/feedback', ...manager, feedbackController.workshopFeedback);
router.get('/:id/feedback/questions', ...manager, feedbackController.getQuestions);
router.put('/:id/feedback/questions', ...manager, feedbackController.saveQuestions);

export default router;
