import { randomInt, randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import {
  STATUS_DETAIL,
  type ChargeField,
  type ChargeValidationResult,
  type PayerEcho,
  type SnailPayControllerOptions,
  type SnailPayResponse,
  type SnailPayStatus,
} from '../types/snailPay.types';

/* ------------------------------------------------------------------ */
/* Tarjetas ficticias del sandbox                                      */
/* ------------------------------------------------------------------ */
export const TEST_CARDS = {
  approved: { number: '1234123412341234', expiration: '12/26', cvv: '543' },
  insufficientFunds: '5555000000000001',
  blocked: '5555000000000002',
} as const;

/** Monto que detona un error interno simulado (HTTP 500). */
export const SIMULATED_FAILURE_AMOUNT = 9999;
export const MAX_TRANSACTION_AMOUNT = 10_000;
export const SIMULATE_ERROR_HEADER = 'x-simulate-error';

const EXPIRATION_PATTERN = /^(0[1-9]|1[0-2])\/(\d{2})$/;
const CVV_PATTERN = /^\d{3}$/;
const CARD_PATTERN = /^\d{16}$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;

/* ------------------------------------------------------------------ */
/* Construcción de respuestas                                          */
/* ------------------------------------------------------------------ */
function buildReference(date: Date): string {
  const ymd = date.toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  return `SR-${ymd}-${suffix}`;
}

export function buildSnailPayResponse(
  status: SnailPayStatus,
  statusDetail: string,
  payer: PayerEcho,
  now: Date = new Date(),
): SnailPayResponse {
  const base: SnailPayResponse = {
    id: `sp_${randomUUID()}`,
    status,
    status_detail: statusDetail,
    transaction_amount: payer.transaction_amount,
    date_created: now.toISOString(),
    reference: buildReference(now),
    payer_id: payer.payer_id,
    payer_email: payer.payer_email,
  };
  if (status === 'approved') {
    return { ...base, authorization_code: String(randomInt(0, 1_000_000)).padStart(6, '0') };
  }
  return base;
}

export const EMPTY_PAYER: PayerEcho = { transaction_amount: 0, payer_id: '', payer_email: '' };

/* ------------------------------------------------------------------ */
/* Validación del request (sin confiar en el cliente)                  */
/* ------------------------------------------------------------------ */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(body: Record<string, unknown>, key: ChargeField): string | null {
  const value = body[key];
  return typeof value === 'string' ? value.trim() : null;
}

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
}

export function validateChargeRequest(body: unknown): ChargeValidationResult {
  const source = isRecord(body) ? body : {};
  const invalidFields: ChargeField[] = [];

  const cardNumber = readString(source, 'card_number')?.replace(/[\s-]/g, '') ?? null;
  if (cardNumber === null || !CARD_PATTERN.test(cardNumber)) invalidFields.push('card_number');

  const expiration = readString(source, 'expiration_date');
  if (expiration === null || !EXPIRATION_PATTERN.test(expiration)) invalidFields.push('expiration_date');

  const cvv = readString(source, 'cvv');
  if (cvv === null || !CVV_PATTERN.test(cvv)) invalidFields.push('cvv');

  const name = readString(source, 'cardholder_name');
  if (name === null || name.length === 0 || name.length > 100) invalidFields.push('cardholder_name');

  const rawAmount = source['transaction_amount'];
  const amount = typeof rawAmount === 'number' && Number.isFinite(rawAmount) ? rawAmount : null;
  if (amount === null || amount <= 0 || amount > MAX_TRANSACTION_AMOUNT || !hasAtMostTwoDecimals(amount)) {
    invalidFields.push('transaction_amount');
  }

  const payerId = readString(source, 'payer_id');
  if (payerId === null || payerId.length === 0) invalidFields.push('payer_id');

  const payerEmail = readString(source, 'payer_email');
  if (payerEmail === null || !EMAIL_PATTERN.test(payerEmail)) invalidFields.push('payer_email');

  if (
    invalidFields.length > 0 ||
    cardNumber === null ||
    expiration === null ||
    cvv === null ||
    name === null ||
    amount === null ||
    payerId === null ||
    payerEmail === null
  ) {
    return {
      ok: false,
      invalidFields,
      payer: { transaction_amount: amount ?? 0, payer_id: payerId ?? '', payer_email: payerEmail ?? '' },
    };
  }

  return {
    ok: true,
    value: {
      card_number: cardNumber,
      expiration_date: expiration,
      cvv,
      cardholder_name: name,
      transaction_amount: amount,
      payer_id: payerId,
      payer_email: payerEmail,
    },
  };
}

/** La tarjeta es válida hasta el último día del mes indicado (MM/AA). */
export function isExpired(expiration: string, now: Date): boolean {
  const match = EXPIRATION_PATTERN.exec(expiration);
  if (match === null || match[1] === undefined || match[2] === undefined) return true;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const firstDayAfterExpiry = new Date(Date.UTC(year, month, 1));
  return now.getTime() >= firstDayAfterExpiry.getTime();
}

/* ------------------------------------------------------------------ */
/* Reglas de negocio del sandbox                                       */
/* ------------------------------------------------------------------ */
interface Decision {
  status: Exclude<SnailPayStatus, 'error'>;
  detail: string;
}

export function decideCharge(
  card: { number: string; expiration: string; cvv: string },
  now: Date,
): Decision {
  if (card.number === TEST_CARDS.insufficientFunds) {
    return { status: 'rejected', detail: STATUS_DETAIL.insufficientAmount };
  }
  if (card.number === TEST_CARDS.blocked) {
    return { status: 'rejected', detail: STATUS_DETAIL.blacklisted };
  }
  if (isExpired(card.expiration, now)) {
    return { status: 'rejected', detail: STATUS_DETAIL.cardExpired };
  }
  if (card.number === TEST_CARDS.approved.number) {
    if (card.expiration !== TEST_CARDS.approved.expiration) {
      return { status: 'rejected', detail: STATUS_DETAIL.badExpirationDate };
    }
    if (card.cvv !== TEST_CARDS.approved.cvv) {
      return { status: 'rejected', detail: STATUS_DETAIL.badSecurityCode };
    }
    return { status: 'approved', detail: STATUS_DETAIL.accredited };
  }
  return { status: 'rejected', detail: STATUS_DETAIL.cardNotSupported };
}

const delay = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

/* ------------------------------------------------------------------ */
/* Controlador                                                          */
/* ------------------------------------------------------------------ */
export function createSnailPayController(options: SnailPayControllerOptions) {
  return {
    async charge(req: Request, res: Response): Promise<void> {
      res.setHeader('Cache-Control', 'no-store');
      await delay(options.latencyMs);
      const now = options.now();

      // Escenario 3a: indisponibilidad simulada por header.
      if (req.header(SIMULATE_ERROR_HEADER)?.toLowerCase() === 'true') {
        const payer = validateChargeRequest(req.body);
        const echo = payer.ok ? payer.value : payer.payer;
        res.status(500).json(buildSnailPayResponse('error', STATUS_DETAIL.serviceUnavailable, echo, now));
        return;
      }

      const validation = validateChargeRequest(req.body);
      if (!validation.ok) {
        const detail = `${STATUS_DETAIL.invalidRequest}: ${validation.invalidFields.join(',')}`;
        res.status(400).json(buildSnailPayResponse('rejected', detail, validation.payer, now));
        return;
      }

      const request = validation.value;
      // Datos de pagador seguros para reflejar: jamás se devuelven tarjeta ni CVV.
      const payer: PayerEcho = {
        transaction_amount: request.transaction_amount,
        payer_id: request.payer_id,
        payer_email: request.payer_email,
      };

      // Escenario 3b: indisponibilidad simulada por monto específico.
      if (request.transaction_amount === SIMULATED_FAILURE_AMOUNT) {
        res.status(500).json(buildSnailPayResponse('error', STATUS_DETAIL.serviceUnavailable, payer, now));
        return;
      }

      // Escenarios 1 y 2: cobro aprobado o rechazo controlado.
      const decision = decideCharge(
        { number: request.card_number, expiration: request.expiration_date, cvv: request.cvv },
        now,
      );
      res.status(201).json(buildSnailPayResponse(decision.status, decision.detail, payer, now));
    },
  };
}

export type SnailPayController = ReturnType<typeof createSnailPayController>;
