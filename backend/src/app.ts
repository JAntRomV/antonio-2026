import cors from 'cors';
import express, { type Express } from 'express';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { createSnailPayRouter } from './routes/snailPay.routes';
import { SIMULATE_ERROR_HEADER } from './controllers/snailPay.controller';

export interface AppOptions {
  /** Orígenes permitidos por CORS. */
  corsOrigins: string[];
  /** Latencia artificial de la pasarela (ms). 0 en pruebas. */
  latencyMs: number;
  /** Reloj inyectable para la lógica de vencimiento. */
  now: () => Date;
}

const DEFAULT_OPTIONS: AppOptions = {
  corsOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  latencyMs: 0,
  now: () => new Date(),
};

export function createApp(overrides: Partial<AppOptions> = {}): Express {
  const options: AppOptions = { ...DEFAULT_OPTIONS, ...overrides };
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      origin: options.corsOrigins,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', SIMULATE_ERROR_HEADER],
    }),
  );
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'snailpay', date: new Date().toISOString() });
  });

  app.use('/api/snailpay', createSnailPayRouter({ latencyMs: options.latencyMs, now: options.now }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
