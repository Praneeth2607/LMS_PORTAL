import { Router } from 'express';
import healthRoutes from './health.routes.js';

// Mounted at /api. Register each feature router here, e.g.
//   router.use('/auth', authRoutes);
//   router.use('/workshops', workshopRoutes);
const router = Router();

router.use('/health', healthRoutes);

export default router;
