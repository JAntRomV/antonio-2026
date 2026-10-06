import { createApp } from './app';

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const port = readPositiveInt(process.env['PORT'], 4000);
const latencyMs = readPositiveInt(process.env['SNAILPAY_LATENCY_MS'], 700);
const corsOrigins = (process.env['CORS_ORIGINS'] ?? 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const app = createApp({ corsOrigins, latencyMs });

const server = app.listen(port, () => {
  console.log(`🐌 SnailPay API escuchando en http://localhost:${port} (latencia simulada ${latencyMs} ms)`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`Recibido ${signal}, cerrando servidor...`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
