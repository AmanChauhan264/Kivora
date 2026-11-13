import { Router } from 'express';
import { HealthController } from './health.controller';

const router: Router = Router();

router.get('/health', (req, res, next) => {
  HealthController.getHealth(req, res).catch(next);
});

export const healthRoutes: Router = router;
