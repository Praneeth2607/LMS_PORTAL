import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import workshopRoutes from './workshop.routes.js';
import sessionRoutes from './session.routes.js';
import certificateRoutes from './certificate.routes.js';
import adminRoutes from './admin.routes.js';
import meRoutes from './me.routes.js';
import i18nRoutes from './i18n.routes.js';

// Mounted at /api. See docs/API.md for the full contract.
const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/workshops', workshopRoutes);
router.use('/sessions', sessionRoutes);
router.use('/certificates', certificateRoutes);
router.use('/admin', adminRoutes);
router.use('/i18n', i18nRoutes);
router.use('/', meRoutes);

export default router;
