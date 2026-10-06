import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { isExpired } from '../src/controllers/snailPay.controller';
import type { SnailPayChargeRequest, SnailPayResponse } from '../src/types/snailPay.types';

const FIXED_NOW = new Date('2026-10-06T17:00:00.000Z');
const ENDPOINT = '/api/snailpay/charge';

const validCharge: SnailPayChargeRequest = {
  card_number: '1234123412341234',
  expiration_date: '12/26',
  cvv: '543',
  cardholder_name: 'Ana María López',
  transaction_amount: 500,
  payer_id: 'usr_7f3a9c21-4b8e',
  payer_email: 'ana@example.com',
};

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function expectStandardSchema(body: SnailPayResponse): void {
  expect(typeof body.id).toBe('string');
  expect(body.id.length).toBeGreaterThan(0);
  expect(['approved', 'rejected', 'error']).toContain(body.status);
  expect(typeof body.status_detail).toBe('string');
  expect(typeof body.transaction_amount).toBe('number');
  expect(body.date_created).toMatch(ISO_8601);
  expect(typeof body.reference).toBe('string');
  expect(typeof body.payer_id).toBe('string');
  expect(typeof body.payer_email).toBe('string');
}

function expectNoSensitiveData(raw: string, charge: SnailPayChargeRequest): void {
  const digits = charge.card_number.replace(/\s/g, '');
  expect(raw).not.toContain(digits);
  expect(raw).not.toContain('card_number');
  expect(raw).not.toContain('"cvv"');
  expect(raw).not.toContain(`"${charge.cvv}"`);
}

describe('POST /api/snailpay/charge', () => {
  let app: Express;

  beforeEach(() => {
    app = createApp({ latencyMs: 0, now: () => FIXED_NOW });
  });

  describe('cobro exitoso', () => {
    it('aprueba la tarjeta de prueba y devuelve authorization_code', async () => {
      const res = await request(app).post(ENDPOINT).send(validCharge);
      const body = res.body as SnailPayResponse;

      expect(res.status).toBe(201);
      expectStandardSchema(body);
      expect(body.status).toBe('approved');
      expect(body.status_detail).toBe('accredited');
      expect(body.authorization_code).toMatch(/^\d{6}$/);
      expect(body.transaction_amount).toBe(500);
      expect(body.payer_id).toBe(validCharge.payer_id);
      expect(body.payer_email).toBe(validCharge.payer_email);
      expect(body.date_created).toBe(FIXED_NOW.toISOString());
    });

    it('acepta el número de tarjeta con espacios', async () => {
      const res = await request(app).post(ENDPOINT).send({ ...validCharge, card_number: '1234 1234 1234 1234' });
      expect(res.status).toBe(201);
      expect((res.body as SnailPayResponse).status).toBe('approved');
    });

    it('nunca expone número de tarjeta ni CVV en la respuesta', async () => {
      const res = await request(app).post(ENDPOINT).send(validCharge);
      expectNoSensitiveData(res.text, validCharge);
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('genera identificadores únicos por transacción', async () => {
      const [a, b] = await Promise.all([
        request(app).post(ENDPOINT).send(validCharge),
        request(app).post(ENDPOINT).send(validCharge),
      ]);
      const first = a.body as SnailPayResponse;
      const second = b.body as SnailPayResponse;
      expect(first.id).not.toBe(second.id);
      expect(first.reference).not.toBe(second.reference);
    });
  });

  describe('rechazos controlados', () => {
    it.each([
      ['fondos insuficientes', { card_number: '5555000000000001', expiration_date: '10/28', cvv: '111' }, 'cc_rejected_insufficient_amount'],
      ['tarjeta bloqueada', { card_number: '5555000000000002', expiration_date: '10/28', cvv: '222' }, 'cc_rejected_blacklist'],
      ['tarjeta expirada', { card_number: '4000000000000002', expiration_date: '09/26', cvv: '123' }, 'cc_rejected_card_expired'],
      ['CVV incorrecto', { cvv: '000' }, 'cc_rejected_bad_filled_security_code'],
      ['vencimiento incorrecto', { expiration_date: '11/27' }, 'cc_rejected_bad_filled_date'],
      ['tarjeta no soportada', { card_number: '4111111111111111', expiration_date: '10/30' }, 'cc_rejected_card_not_supported'],
    ] as const)('rechaza por %s', async (_label, overrides, expectedDetail) => {
      const charge = { ...validCharge, ...overrides };
      const res = await request(app).post(ENDPOINT).send(charge);
      const body = res.body as SnailPayResponse;

      expect(res.status).toBe(201);
      expectStandardSchema(body);
      expect(body.status).toBe('rejected');
      expect(body.status_detail).toBe(expectedDetail);
      expect(body.authorization_code).toBeUndefined();
      expectNoSensitiveData(res.text, charge);
    });

    it.each([
      ['monto cero', { transaction_amount: 0 }, 'transaction_amount'],
      ['monto negativo', { transaction_amount: -50 }, 'transaction_amount'],
      ['monto con más de 2 decimales', { transaction_amount: 10.555 }, 'transaction_amount'],
      ['monto como string', { transaction_amount: '500' }, 'transaction_amount'],
      ['nombre vacío', { cardholder_name: '   ' }, 'cardholder_name'],
      ['correo inválido', { payer_email: 'no-es-correo' }, 'payer_email'],
      ['tarjeta con 15 dígitos', { card_number: '123412341234123' }, 'card_number'],
      ['vencimiento mal formado', { expiration_date: '13/26' }, 'expiration_date'],
      ['CVV con letras', { cvv: '5a3' }, 'cvv'],
    ] as const)('responde 400 si hay %s', async (_label, overrides, field) => {
      const res = await request(app).post(ENDPOINT).send({ ...validCharge, ...overrides });
      const body = res.body as SnailPayResponse;

      expect(res.status).toBe(400);
      expectStandardSchema(body);
      expect(body.status).toBe('rejected');
      expect(body.status_detail).toContain('invalid_request');
      expect(body.status_detail).toContain(field);
    });

    it('responde 400 cuando faltan todos los campos', async () => {
      const res = await request(app).post(ENDPOINT).send({});
      const body = res.body as SnailPayResponse;
      expect(res.status).toBe(400);
      expectStandardSchema(body);
      expect(body.status_detail).toContain('card_number');
      expect(body.status_detail).toContain('payer_id');
    });

    it('responde 400 ante JSON mal formado', async () => {
      const res = await request(app)
        .post(ENDPOINT)
        .set('Content-Type', 'application/json')
        .send('{"card_number": "1234",');
      const body = res.body as SnailPayResponse;
      expect(res.status).toBe(400);
      expectStandardSchema(body);
      expect(body.status_detail).toBe('invalid_json');
    });
  });

  describe('error del sistema', () => {
    it('devuelve 500 con status error si llega el header x-simulate-error: true', async () => {
      const res = await request(app).post(ENDPOINT).set('x-simulate-error', 'true').send(validCharge);
      const body = res.body as SnailPayResponse;

      expect(res.status).toBe(500);
      expectStandardSchema(body);
      expect(body.status).toBe('error');
      expect(body.status_detail).toBe('service_unavailable');
      expect(body.authorization_code).toBeUndefined();
      expectNoSensitiveData(res.text, validCharge);
    });

    it('devuelve 500 cuando el monto es 9999', async () => {
      const res = await request(app).post(ENDPOINT).send({ ...validCharge, transaction_amount: 9999 });
      const body = res.body as SnailPayResponse;

      expect(res.status).toBe(500);
      expectStandardSchema(body);
      expect(body.status).toBe('error');
      expect(body.transaction_amount).toBe(9999);
    });

    it('ignora el header cuando su valor no es "true"', async () => {
      const res = await request(app).post(ENDPOINT).set('x-simulate-error', 'false').send(validCharge);
      expect(res.status).toBe(201);
      expect((res.body as SnailPayResponse).status).toBe('approved');
    });
  });

  describe('infraestructura', () => {
    it('responde 404 con el esquema estándar en rutas inexistentes', async () => {
      const res = await request(app).get('/api/snailpay/unknown');
      expect(res.status).toBe(404);
      expectStandardSchema(res.body as SnailPayResponse);
    });

    it('expone un health check', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'ok' });
    });

    it('permite el header x-simulate-error en CORS', async () => {
      const res = await request(app)
        .options(ENDPOINT)
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type,x-simulate-error');
      expect(res.status).toBe(204);
      expect(String(res.headers['access-control-allow-headers'])).toContain('x-simulate-error');
    });
  });
});

describe('isExpired', () => {
  it('considera válida la tarjeta durante todo su mes de vencimiento', () => {
    expect(isExpired('10/26', new Date('2026-10-31T23:59:59.000Z'))).toBe(false);
    expect(isExpired('10/26', new Date('2026-11-01T00:00:00.000Z'))).toBe(true);
    expect(isExpired('12/26', FIXED_NOW)).toBe(false);
  });
});
