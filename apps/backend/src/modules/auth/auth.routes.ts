import { Router } from 'express';
import { AuthController } from './auth.controller';
import {
  customerRegisterSchema,
  sellerRegisterSchema,
  loginSchema,
  validateBody,
} from './auth.validation';
import { authenticateAccessToken } from '../../middleware/authenticate';
import { csrfProtection } from '../../middleware/csrf';
import {
  loginRateLimiter,
  registerRateLimiter,
  refreshRateLimiter,
} from '../../middleware/rate-limiter';

const router: Router = Router();

// 1. Registration
router.post(
  '/register/customer',
  registerRateLimiter,
  validateBody(customerRegisterSchema),
  AuthController.registerCustomer
);

router.post(
  '/register/seller',
  registerRateLimiter,
  validateBody(sellerRegisterSchema),
  AuthController.registerSeller
);

// 2. Login
router.post('/login', loginRateLimiter, validateBody(loginSchema), AuthController.login);

// 3. Refresh Token Rotation
router.post('/refresh', refreshRateLimiter, csrfProtection, AuthController.refreshToken);

// 4. Logout (current session)
router.post('/logout', csrfProtection, AuthController.logout);

// 5. Logout All (all devices - requires authentication)
router.post('/logout-all', authenticateAccessToken, AuthController.logoutAll);

// 6. Current User Profile (requires authentication)
router.get('/me', authenticateAccessToken, AuthController.getMe);

export const authRoutes: Router = router;
