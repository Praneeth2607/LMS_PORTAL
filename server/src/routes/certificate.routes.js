import { Router } from 'express';
import * as certificateController from '../controllers/certificate.controller.js';
import { authenticate } from '../middleware/auth.js';

// Mounted at /api/certificates. /verify must stay above /:id.
const router = Router();

router.get('/verify/:certificateId', certificateController.verify);
router.get('/:id', authenticate, certificateController.get);
router.get('/:id/download', authenticate, certificateController.download);

export default router;
