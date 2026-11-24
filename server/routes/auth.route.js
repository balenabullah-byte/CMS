import { Router } from 'express';
import controller from '../controller/auth.controller.js';
import schemas from '../validation/auth.validation.js';
import validate from '../middleware/validate.middleware.js';
import authenticate from '../middleware/auth.middleware.js';
import { limit } from '../middleware/rate.middleware.js';
const router = Router();
router.post('/auth/login', limit(15, 'login'), validate(schemas.login), controller.login);
router.post('/auth/logout', authenticate, validate(schemas.logout), controller.logout);
router.get('/me', authenticate, validate(schemas.me), controller.me);
export default router;


