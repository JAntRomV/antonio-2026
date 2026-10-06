import type { AuthResult, LoginInput, PublicUser, RegisterInput, Session, StoredUser } from '../types';

/**
 * Capa de persistencia y autenticación simulada sobre localStorage.
 *
 * Criterio de custodia de contraseñas:
 *  - Nunca se guarda la contraseña en claro.
 *  - Se deriva un hash con PBKDF2-SHA256 (Web Crypto) usando una sal aleatoria por usuario.
 *  - El login vuelve a derivar el hash con la sal guardada y compara en tiempo constante.
 * Es una simulación local: en producción la verificación debe vivir en el servidor.
 */

export const STORAGE_KEYS = {
  users: 'snailracer:users',
  session: 'snailracer:session',
} as const;

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

export const AUTH_ERRORS = {
  emailTaken: 'Ya existe una cuenta registrada con este correo.',
  invalidCredentials: 'Correo o contraseña incorrectos.',
  storageUnavailable: 'No se pudo acceder al almacenamiento local del navegador.',
} as const;

/* ---------------------------- utilidades ---------------------------- */

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

async function derivePasswordHash(password: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    HASH_BITS,
  );
  return toHex(new Uint8Array(bits));
}

function generateSalt(): string {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  return toHex(salt);
}

function generateUserId(): string {
  return `usr_${crypto.randomUUID()}`;
}

/* ------------------------- lectura validada ------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStoredUser(value: unknown): value is StoredUser {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['fullName'] === 'string' &&
    typeof value['email'] === 'string' &&
    typeof value['passwordHash'] === 'string' &&
    typeof value['passwordSalt'] === 'string' &&
    typeof value['balance'] === 'number' &&
    Number.isFinite(value['balance']) &&
    typeof value['createdAt'] === 'string'
  );
}

function isSession(value: unknown): value is Session {
  return isRecord(value) && typeof value['userId'] === 'string' && typeof value['startedAt'] === 'string';
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

type UserMap = Record<string, StoredUser>;

function readUsers(): UserMap {
  const data = readJson(STORAGE_KEYS.users);
  if (!isRecord(data)) return {};
  const users: UserMap = {};
  for (const [email, user] of Object.entries(data)) {
    if (isStoredUser(user)) users[email] = user;
  }
  return users;
}

function writeUsers(users: UserMap): void {
  writeJson(STORAGE_KEYS.users, users);
}

function findUserById(users: UserMap, id: string): StoredUser | null {
  return Object.values(users).find((u) => u.id === id) ?? null;
}

export function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    balance: user.balance,
    createdAt: user.createdAt,
  };
}

function startSession(userId: string): void {
  const session: Session = { userId, startedAt: new Date().toISOString() };
  writeJson(STORAGE_KEYS.session, session);
}

/* ------------------------------- API ------------------------------- */

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  try {
    const email = normalizeEmail(input.email);
    const users = readUsers();
    if (users[email] !== undefined) return { ok: false, error: AUTH_ERRORS.emailTaken };

    const passwordSalt = generateSalt();
    const passwordHash = await derivePasswordHash(input.password, passwordSalt);
    const user: StoredUser = {
      id: generateUserId(),
      fullName: input.fullName.trim().replace(/\s+/g, ' '),
      email,
      passwordHash,
      passwordSalt,
      balance: 0,
      createdAt: new Date().toISOString(),
    };

    writeUsers({ ...users, [email]: user });
    startSession(user.id);
    return { ok: true, user: toPublicUser(user) };
  } catch {
    return { ok: false, error: AUTH_ERRORS.storageUnavailable };
  }
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  try {
    const user = readUsers()[normalizeEmail(input.email)];
    if (user === undefined) return { ok: false, error: AUTH_ERRORS.invalidCredentials };

    const candidate = await derivePasswordHash(input.password, user.passwordSalt);
    if (!timingSafeEqual(candidate, user.passwordHash)) {
      return { ok: false, error: AUTH_ERRORS.invalidCredentials };
    }

    startSession(user.id);
    return { ok: true, user: toPublicUser(user) };
  } catch {
    return { ok: false, error: AUTH_ERRORS.storageUnavailable };
  }
}

/** Restaura el usuario de la sesión activa (persistencia al recargar). */
export function getSessionUser(): PublicUser | null {
  const session = readJson(STORAGE_KEYS.session);
  if (!isSession(session)) return null;
  const user = findUserById(readUsers(), session.userId);
  if (user === null) {
    clearSession();
    return null;
  }
  return toPublicUser(user);
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.session);
  } catch {
    /* almacenamiento no disponible: no hay sesión que limpiar */
  }
}

/** Suma un monto al saldo del usuario y devuelve el usuario actualizado. */
export function creditBalance(userId: string, amount: number): PublicUser | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const users = readUsers();
  const user = findUserById(users, userId);
  if (user === null) return null;
  const updated: StoredUser = { ...user, balance: roundMoney(user.balance + amount) };
  writeUsers({ ...users, [user.email]: updated });
  return toPublicUser(updated);
}
