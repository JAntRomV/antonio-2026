/**
 * Contratos de la pasarela simulada SnailPay.
 * La forma de SnailPayResponse es obligatoria según la especificación (sección 2.3/2.4).
 */

export type SnailPayStatus = 'approved' | 'rejected' | 'error';

/** Cuerpo esperado por POST /api/snailpay/charge. */
export interface SnailPayChargeRequest {
  card_number: string;
  expiration_date: string; // MM/AA
  cvv: string;
  cardholder_name: string;
  transaction_amount: number; // > 0
  payer_id: string;
  payer_email: string;
}

/** Esquema de respuesta estándar obligatorio. Nunca incluye número de tarjeta ni CVV. */
export interface SnailPayResponse {
  id: string;
  status: SnailPayStatus;
  status_detail: string;
  transaction_amount: number;
  date_created: string; // ISO 8601
  authorization_code?: string;
  reference: string;
  payer_id: string;
  payer_email: string;
}

/** Códigos de detalle que puede devolver la pasarela. */
export const STATUS_DETAIL = {
  accredited: 'accredited',
  insufficientAmount: 'cc_rejected_insufficient_amount',
  blacklisted: 'cc_rejected_blacklist',
  cardExpired: 'cc_rejected_card_expired',
  badSecurityCode: 'cc_rejected_bad_filled_security_code',
  badExpirationDate: 'cc_rejected_bad_filled_date',
  cardNotSupported: 'cc_rejected_card_not_supported',
  invalidRequest: 'invalid_request',
  invalidJson: 'invalid_json',
  payloadTooLarge: 'payload_too_large',
  notFound: 'not_found',
  serviceUnavailable: 'service_unavailable',
  internalError: 'internal_server_error',
} as const;

export type StatusDetailCode = (typeof STATUS_DETAIL)[keyof typeof STATUS_DETAIL];

/** Campos del request que pueden fallar la validación. */
export type ChargeField = keyof SnailPayChargeRequest;

export type ChargeValidationResult =
  | { ok: true; value: SnailPayChargeRequest }
  | { ok: false; invalidFields: ChargeField[]; payer: PayerEcho };

/** Datos no sensibles que se reflejan en la respuesta aunque el request sea inválido. */
export interface PayerEcho {
  transaction_amount: number;
  payer_id: string;
  payer_email: string;
}

/** Opciones inyectables del controlador (facilitan las pruebas deterministas). */
export interface SnailPayControllerOptions {
  /** Latencia artificial para simular la red (ms). */
  latencyMs: number;
  /** Reloj inyectable para evaluar vencimientos. */
  now: () => Date;
}
