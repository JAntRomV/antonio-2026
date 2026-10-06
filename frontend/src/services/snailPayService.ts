import type { ChargeOptions, ChargeResult, SnailPayChargeRequest, SnailPayResponse } from '../types';

const API_BASE_URL: string = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '';
const CHARGE_ENDPOINT = `${API_BASE_URL}/api/snailpay/charge`;
const REQUEST_TIMEOUT_MS = 10_000;

/** Mensajes legibles para cada código de status_detail. */
const STATUS_DETAIL_MESSAGES: Record<string, string> = {
  accredited: 'Tu recarga se acreditó correctamente.',
  cc_rejected_insufficient_amount: 'La tarjeta no tiene fondos suficientes para este monto.',
  cc_rejected_blacklist: 'La tarjeta está bloqueada. Contacta a tu banco o usa otra tarjeta.',
  cc_rejected_card_expired: 'La tarjeta está vencida.',
  cc_rejected_bad_filled_security_code: 'El código de seguridad (CVV) es incorrecto.',
  cc_rejected_bad_filled_date: 'La fecha de vencimiento no coincide con la tarjeta.',
  cc_rejected_card_not_supported: 'Esta tarjeta no está habilitada en el entorno de pruebas.',
  invalid_request: 'Algunos datos del pago son inválidos. Revísalos e inténtalo de nuevo.',
  invalid_json: 'La solicitud de pago está mal formada.',
  service_unavailable: 'SnailPay no está disponible en este momento. Tu saldo no cambió; inténtalo más tarde.',
  internal_server_error: 'Ocurrió un error interno en SnailPay. Tu saldo no cambió.',
};

const NETWORK_ERROR_MESSAGE = 'No pudimos conectar con SnailPay. Revisa tu conexión; tu saldo no cambió.';
const TIMEOUT_MESSAGE = 'SnailPay tardó demasiado en responder. Tu saldo no cambió.';
const UNEXPECTED_MESSAGE = 'Respuesta inesperada de SnailPay. Tu saldo no cambió.';

export function describeStatusDetail(detail: string): string {
  const code = detail.split(':')[0]?.trim() ?? detail;
  return STATUS_DETAIL_MESSAGES[code] ?? 'El pago fue rechazado.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isSnailPayResponse(value: unknown): value is SnailPayResponse {
  if (!isRecord(value)) return false;
  const status = value['status'];
  const authCode = value['authorization_code'];
  return (
    typeof value['id'] === 'string' &&
    (status === 'approved' || status === 'rejected' || status === 'error') &&
    typeof value['status_detail'] === 'string' &&
    typeof value['transaction_amount'] === 'number' &&
    typeof value['date_created'] === 'string' &&
    (authCode === undefined || typeof authCode === 'string') &&
    typeof value['reference'] === 'string' &&
    typeof value['payer_id'] === 'string' &&
    typeof value['payer_email'] === 'string'
  );
}

async function readBody(res: Response): Promise<unknown> {
  try {
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

/**
 * Envía un cargo a SnailPay y normaliza el resultado.
 * Nunca lanza: cualquier fallo (red, timeout, 5xx, respuesta inválida) se traduce a { kind: 'error' }.
 * Los datos de tarjeta solo viajan en el cuerpo del request; no se registran ni se persisten.
 */
export async function charge(request: SnailPayChargeRequest, options: ChargeOptions = {}): Promise<ChargeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onExternalAbort = (): void => controller.abort();
  options.signal?.addEventListener('abort', onExternalAbort, { once: true });

  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (options.simulateError === true) headers['x-simulate-error'] = 'true';

  try {
    const res = await fetch(CHARGE_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    const body = await readBody(res);

    if (!isSnailPayResponse(body)) {
      return { kind: 'error', message: res.ok ? UNEXPECTED_MESSAGE : NETWORK_ERROR_MESSAGE, response: null };
    }

    if (res.status >= 500 || body.status === 'error') {
      return { kind: 'error', message: describeStatusDetail(body.status_detail), response: body };
    }
    if (body.status === 'approved' && res.ok && typeof body.authorization_code === 'string') {
      return { kind: 'approved', response: body };
    }
    if (body.status === 'rejected') {
      return { kind: 'rejected', response: body, message: describeStatusDetail(body.status_detail) };
    }
    return { kind: 'error', message: UNEXPECTED_MESSAGE, response: body };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    return { kind: 'error', message: aborted ? TIMEOUT_MESSAGE : NETWORK_ERROR_MESSAGE, response: null };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}
