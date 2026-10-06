import { Router } from 'express';
import { createSnailPayController } from '../controllers/snailPay.controller';
import type { SnailPayControllerOptions } from '../types/snailPay.types';

/**
 * Rutas de SnailPay. Se montan bajo /api/snailpay en app.ts.
 *   POST /api/snailpay/charge
 */
export function createSnailPayRouter(options: SnailPayControllerOptions): Router {
  const router = Router();
  const controller = createSnailPayController(options);

  router.post('/charge', controller.charge);

  return router;
}
