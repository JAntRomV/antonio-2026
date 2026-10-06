import type { FieldErrors, LoginFormValues, PaymentFormValues, RegisterFormValues } from '../types';

export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;
export const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ'.-]+( [A-Za-zÀ-ÖØ-öø-ÿ'.-]+)+$/;
export const MAX_RECHARGE = 10_000;

export const MESSAGES = {
  nameRequired: 'Ingresa tu nombre completo.',
  nameInvalid: 'Escribe nombre y apellido usando solo letras (5 a 80 caracteres).',
  emailRequired: 'Ingresa tu correo electrónico.',
  emailInvalid: 'Ingresa un correo válido, por ejemplo nombre@dominio.com.',
  passwordRequired: 'Ingresa tu contraseña.',
  passwordShort: 'Ingresa tu contraseña (mínimo 8 caracteres).',
  passwordWeak: 'Usa mínimo 8 caracteres, con mayúsculas, minúsculas y al menos un número.',
  confirmRequired: 'Confirma tu contraseña.',
  confirmMismatch: 'Las contraseñas no coinciden.',
  amountInvalid: 'Ingresa un monto mayor a $0 y hasta $10,000.00 (máximo 2 decimales).',
  holderRequired: 'Ingresa el nombre del titular.',
  cardInvalid: 'El número de tarjeta debe tener 16 dígitos.',
  expInvalid: 'Usa el formato MM/AA.',
  cvvInvalid: 'El CVV tiene 3 dígitos.',
} as const;

function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (value.length === 0) return MESSAGES.emailRequired;
  if (value.length > 254 || !EMAIL_PATTERN.test(value)) return MESSAGES.emailInvalid;
  return undefined;
}

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 128 &&
    /\d/.test(password) &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password)
  );
}

export function validateRegister(values: RegisterFormValues): FieldErrors<RegisterFormValues> {
  const errors: FieldErrors<RegisterFormValues> = {};
  const name = values.fullName.trim().replace(/\s+/g, ' ');

  if (name.length === 0) errors.fullName = MESSAGES.nameRequired;
  else if (name.length < 5 || name.length > 80 || !NAME_PATTERN.test(name)) errors.fullName = MESSAGES.nameInvalid;

  const emailError = validateEmail(values.email);
  if (emailError !== undefined) errors.email = emailError;

  if (values.password.length === 0) errors.password = MESSAGES.passwordRequired;
  else if (!isStrongPassword(values.password)) errors.password = MESSAGES.passwordWeak;

  if (values.confirmPassword.length === 0) errors.confirmPassword = MESSAGES.confirmRequired;
  else if (values.confirmPassword !== values.password) errors.confirmPassword = MESSAGES.confirmMismatch;

  return errors;
}

export function validateLogin(values: LoginFormValues): FieldErrors<LoginFormValues> {
  const errors: FieldErrors<LoginFormValues> = {};
  const emailError = validateEmail(values.email);
  if (emailError !== undefined) errors.email = emailError;

  if (values.password.length === 0) errors.password = MESSAGES.passwordRequired;
  else if (values.password.length < 8) errors.password = MESSAGES.passwordShort;

  return errors;
}

export function parseAmount(raw: string): number | null {
  const value = raw.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= MAX_RECHARGE ? amount : null;
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function validatePayment(values: PaymentFormValues): FieldErrors<PaymentFormValues> {
  const errors: FieldErrors<PaymentFormValues> = {};
  if (parseAmount(values.amount) === null) errors.amount = MESSAGES.amountInvalid;
  if (values.cardholderName.trim().length === 0) errors.cardholderName = MESSAGES.holderRequired;
  if (!/^\d{16}$/.test(digitsOnly(values.cardNumber))) errors.cardNumber = MESSAGES.cardInvalid;
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(values.expirationDate)) errors.expirationDate = MESSAGES.expInvalid;
  if (!/^\d{3}$/.test(values.cvv)) errors.cvv = MESSAGES.cvvInvalid;
  return errors;
}

export function hasErrors<T>(errors: FieldErrors<T>): boolean {
  return Object.values(errors).some((message) => typeof message === 'string' && message.length > 0);
}
