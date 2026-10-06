import type { NextFunction, Request, Response } from 'express';
import { EMPTY_PAYER, buildSnailPayResponse } from '../controllers/snailPay.controller';
import { STATUS_DETAIL } from '../types/snailPay.types';

/** Errores que emite el parser JSON de Express (body-parser). */
interface BodyParserError {
  type: string;
  status: number;
}

function isBodyParserError(err: unknown): err is BodyParserError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    typeof (err as { type: unknown }).type === 'string' &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number'
  );
}

/** 404 con el mismo esquema de respuesta del API. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json(buildSnailPayResponse('error', STATUS_DETAIL.notFound, EMPTY_PAYER));
}

/**
 * Manejador centralizado de errores. Nunca reenvía el cuerpo del request
 * (podría contener datos de tarjeta) ni detalles internos al cliente.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (isBodyParserError(err)) {
    if (err.type === 'entity.parse.failed') {
      res.status(400).json(buildSnailPayResponse('rejected', STATUS_DETAIL.invalidJson, EMPTY_PAYER));
      return;
    }
    if (err.type === 'entity.too.large') {
      res.status(413).json(buildSnailPayResponse('rejected', STATUS_DETAIL.payloadTooLarge, EMPTY_PAYER));
      return;
    }
  }

  const message = err instanceof Error ? err.message : 'Error desconocido';
  console.error(`[snailpay] Error no controlado: ${message}`);
  res.status(500).json(buildSnailPayResponse('error', STATUS_DETAIL.internalError, EMPTY_PAYER));
}
