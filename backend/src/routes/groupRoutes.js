import { Router } from 'express';
import groupController, { createGroupSchema, joinGroupSchema } from '../controllers/groupController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(authenticateToken);

router.get('/', groupController.getUserGroups);
router.post('/', validate(createGroupSchema), groupController.createGroup);
router.post('/join', validate(joinGroupSchema), groupController.joinGroup);
router.get('/:groupId', groupController.getGroupDetails);
router.delete('/:groupId/members/:userId', groupController.removeMember);

export default router;
