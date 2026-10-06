import type { DragEvent } from 'react';
import { digitsOnly } from './validation';

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

export function formatToday(date: Date = new Date()): string {
  const text = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} min`;
}

/** "1234123412341234" → "1234 1234 1234 1234" (máximo 16 dígitos). */
export function formatCardNumber(raw: string): string {
  return digitsOnly(raw)
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** "1226" → "12/26". */
export function formatExpiration(raw: string): string {
  const digits = digitsOnly(raw).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

export function lastFour(cardNumber: string): string {
  return digitsOnly(cardNumber).slice(-4);
}

/**
 * Los formularios no aceptan adjuntos: se bloquea arrastrar/soltar archivos.
 * Se usa en onDragOver y onDrop de cada <form>.
 */
export function blockFileDrop(event: DragEvent<HTMLElement>): void {
  if (Array.from(event.dataTransfer.types).includes('Files')) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'none';
  }
}
