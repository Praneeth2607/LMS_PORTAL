import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

// Mounted at /api/admin. Every route is ADMIN only.
const router = Router();
router.use(authenticate, authorize('ADMIN'));

router.get('/stats', adminController.stats);
router.get('/users', adminController.listUsers);
router.post('/users', adminController.createUser);
router.patch('/users/:id/suspend', adminController.suspend);
router.patch('/users/:id/reactivate', adminController.reactivate);
router.delete('/users/:id', adminController.remove);
router.get('/organizer-requests', adminController.listOrganizerRequests);
router.post('/organizer-requests/:id/approve', adminController.approveOrganizerRequest);
router.post('/organizer-requests/:id/reject', adminController.rejectOrganizerRequest);

export default router;
