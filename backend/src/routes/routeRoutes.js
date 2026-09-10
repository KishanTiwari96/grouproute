import { Router } from 'express';
import routeController from '../controllers/routeController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.post('/calculate', routeController.calculate);

export default router;
