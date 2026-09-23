import { Router } from 'express';
import * as registrationController from '../controllers/registration.controller.js';
import * as certificateController from '../controllers/certificate.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

// Mounted at /api: current-user shortcuts.
const router = Router();

router.get('/my-workshops', authenticate, registrationController.myWorkshops);
router.get('/my-certificates', authenticate, authorize('PARTICIPANT'), certificateController.mine);

export default router;
