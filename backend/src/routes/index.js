import { Router } from 'express';
import authRoutes from './authRoutes.js';
import groupRoutes from './groupRoutes.js';
import tripRoutes from './tripRoutes.js';
import routeRoutes from './routeRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/groups', groupRoutes);
router.use('/trips', tripRoutes);
router.use('/routes', routeRoutes);

export default router;
