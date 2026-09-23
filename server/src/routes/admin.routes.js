import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

// Mounted at /api/admin. Every route is ADMIN only.
const router = Router();
router.use(authenticate, authorize('ADMIN'));

router.get('/stats', adminController.stats);
router.get('/users', adminController.listUsers);
router.post('/users', adminController.createUser);
router.patch('/users/:id/role', adminController.changeRole);

export default router;
