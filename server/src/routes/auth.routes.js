import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/organizer-requests', authController.requestOrganizerAccess);
router.get('/me', authenticate, authController.me);

export default router;
