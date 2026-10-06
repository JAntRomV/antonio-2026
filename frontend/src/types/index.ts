/* =========================================================
 * Usuarios y sesión (persistidos en localStorage)
 * ========================================================= */

/** Registro de usuario tal como se guarda en localStorage. */
export interface StoredUser {
  id: string;
  fullName: string;
  email: string; // normalizado en minúsculas
  /** Hash PBKDF2-SHA256 (hex). La contraseña en claro nunca se persiste. */
  passwordHash: string;
  /** Sal aleatoria por usuario (hex). */
  passwordSalt: string;
  balance: number;
  createdAt: string; // ISO 8601
}

/** Datos del usuario expuestos a la UI (sin credenciales). */
export type PublicUser = Omit<StoredUser, 'passwordHash' | 'passwordSalt'>;

export interface Session {
  userId: string;
  startedAt: string; // ISO 8601
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export type AuthResult = { ok: true; user: PublicUser } | { ok: false; error: string };

/* =========================================================
 * Formularios
 * ========================================================= */

export interface RegisterFormValues {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface PaymentFormValues {
  amount: string;
  cardholderName: string;
  cardNumber: string;
  expirationDate: string;
  cvv: string;
}

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/* =========================================================
 * SnailPay (contrato compartido con el backend)
 * ========================================================= */

export type SnailPayStatus = 'approved' | 'rejected' | 'error';

export interface SnailPayChargeRequest {
  card_number: string;
  expiration_date: string;
  cvv: string;
  cardholder_name: string;
  transaction_amount: number;
  payer_id: string;
  payer_email: string;
}

export interface SnailPayResponse {
  id: string;
  status: SnailPayStatus;
  status_detail: string;
  transaction_amount: number;
  date_created: string;
  authorization_code?: string;
  reference: string;
  payer_id: string;
  payer_email: string;
}

/** Resultado normalizado que la UI consume. */
export type ChargeResult =
  | { kind: 'approved'; response: SnailPayResponse }
  | { kind: 'rejected'; response: SnailPayResponse; message: string }
  | { kind: 'error'; message: string; response: SnailPayResponse | null };

export interface ChargeOptions {
  /** Envía el header x-simulate-error: true para simular una caída. */
  simulateError?: boolean;
  signal?: AbortSignal;
}

/* =========================================================
 * Datos simulados del dashboard
 * ========================================================= */

export type SnailId = 'turbo' | 'concha' | 'rayo' | 'caracolo' | 'espiral' | 'chispa';

export interface Snail {
  id: SnailId;
  name: string;
  color: string;
}

export type BetOutcome = 'won' | 'lost' | 'none';

export interface Race {
  number: number;
  time: string; // HH:mm
  winnerId: SnailId;
  durationSeconds: number;
  betSnailId: SnailId | null;
}

export interface BetStats {
  won: number;
  lost: number;
}

export interface SnailWins {
  id: SnailId;
  name: string;
  wins: number;
  color: string;
}
