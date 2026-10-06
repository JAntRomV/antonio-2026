import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { charge } from '../services/snailPayService';
import type { FieldErrors, PaymentFormValues, PublicUser, SnailPayResponse } from '../types';
import { blockFileDrop, formatCardNumber, formatCurrency, formatExpiration, lastFour } from '../utils/format';
import { digitsOnly, hasErrors, parseAmount, validatePayment } from '../utils/validation';
import { FormField } from './FormField';
import { Spinner } from './Spinner';

interface SnailPayModalProps {
  open: boolean;
  user: PublicUser;
  onClose: () => void;
  /** Se llama solo con cobros aprobados; el padre acredita el saldo. */
  onApproved: (response: SnailPayResponse) => void;
}

type PaymentAlert = { tone: 'rejected' | 'error'; message: string; code: string | null };

interface ApprovedSummary {
  response: SnailPayResponse;
  last4: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function emptyForm(holder: string): PaymentFormValues {
  return { amount: '', cardholderName: holder, cardNumber: '', expirationDate: '', cvv: '' };
}

export function SnailPayModal({ open, user, onClose, onApproved }: SnailPayModalProps) {
  const [values, setValues] = useState<PaymentFormValues>(() => emptyForm(user.fullName));
  const [touched, setTouched] = useState<Partial<Record<keyof PaymentFormValues, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<PaymentAlert | null>(null);
  const [approved, setApproved] = useState<ApprovedSummary | null>(null);
  const [simulateError, setSimulateError] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Reinicia el estado (y descarta los datos de tarjeta) cada vez que se abre.
  useEffect(() => {
    if (!open) return undefined;
    setValues(emptyForm(user.fullName));
    setTouched({});
    setSubmitted(false);
    setAlert(null);
    setApproved(null);
    setSimulateError(false);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => amountRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      abortRef.current?.abort();
    };
  }, [open, user.fullName]);

  if (!open) return null;

  const errors: FieldErrors<PaymentFormValues> = validatePayment(values);
  const visibleError = (field: keyof PaymentFormValues): string | undefined =>
    submitted || touched[field] === true ? errors[field] : undefined;

  const setField = (field: keyof PaymentFormValues, value: string): void => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setAlert(null);
  };
  const touch = (field: keyof PaymentFormValues) => (): void => setTouched((prev) => ({ ...prev, [field]: true }));

  const requestClose = (): void => {
    if (loading) return;
    onClose();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      requestClose();
      return;
    }
    if (event.key !== 'Tab' || dialogRef.current === null) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitted(true);
    const amount = parseAmount(values.amount);
    if (hasErrors(errors) || amount === null || loading) return;

    setLoading(true);
    setAlert(null);
    const controller = new AbortController();
    abortRef.current = controller;

    const result = await charge(
      {
        card_number: digitsOnly(values.cardNumber),
        expiration_date: values.expirationDate,
        cvv: values.cvv,
        cardholder_name: values.cardholderName.trim(),
        transaction_amount: amount,
        payer_id: user.id,
        payer_email: user.email,
      },
      { simulateError, signal: controller.signal },
    );
    if (controller.signal.aborted) return;
    setLoading(false);

    if (result.kind === 'approved') {
      const last4 = lastFour(values.cardNumber);
      // Se descartan los datos sensibles del estado del formulario.
      setValues(emptyForm(user.fullName));
      setApproved({ response: result.response, last4 });
      onApproved(result.response);
      return;
    }

    // En rechazo o error el saldo no se toca; el CVV se limpia por seguridad.
    setValues((prev) => ({ ...prev, cvv: '' }));
    setTouched((prev) => ({ ...prev, cvv: false }));
    setSubmitted(false);
    setAlert({
      tone: result.kind,
      message: result.message,
      code: result.response?.status_detail ?? null,
    });
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div
        ref={dialogRef}
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="snailpay-title"
        onKeyDown={handleKeyDown}
      >
        <header className="modal-head">
          <div>
            <div className="logo-pay">
              <span aria-hidden="true">🐌</span> Snail<b>Pay</b>
            </div>
            <p className="muted small">Pasarela de pagos simulada · Modo sandbox</p>
          </div>
          <button type="button" className="icon-btn" onClick={requestClose} disabled={loading} aria-label="Cerrar SnailPay">
            ✕
          </button>
        </header>

        {approved !== null ? (
          <div className="result" role="status">
            <div className="result-icon ok" aria-hidden="true">
              ✓
            </div>
            <h2 id="snailpay-title">Pago aprobado</h2>
            <p className="muted">Tu recarga se procesó correctamente y el saldo ya está disponible.</p>
            <dl className="dl">
              <div>
                <dt>Monto recargado</dt>
                <dd>{formatCurrency(approved.response.transaction_amount)}</dd>
              </div>
              <div>
                <dt>Nuevo saldo</dt>
                <dd>{formatCurrency(user.balance)}</dd>
              </div>
              <div>
                <dt>Tarjeta</dt>
                <dd>•••• {approved.last4}</dd>
              </div>
              <div>
                <dt>Autorización</dt>
                <dd className="mono small">{approved.response.authorization_code}</dd>
              </div>
              <div>
                <dt>Referencia</dt>
                <dd className="mono small">{approved.response.reference}</dd>
              </div>
            </dl>
            <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
              Volver al dashboard
            </button>
          </div>
        ) : (
          <div className="checkout">
            <aside className="summary">
              <dl className="dl">
                <div>
                  <dt>Cuenta</dt>
                  <dd>{user.fullName}</dd>
                </div>
                <div>
                  <dt>Correo</dt>
                  <dd>{user.email}</dd>
                </div>
                <div>
                  <dt>Saldo actual</dt>
                  <dd>{formatCurrency(user.balance)}</dd>
                </div>
              </dl>
              <details>
                <summary>Tarjetas de prueba</summary>
                <div className="table-wrap">
                  <table className="table table-compact">
                    <thead>
                      <tr>
                        <th>Número</th>
                        <th>Venc.</th>
                        <th>CVV</th>
                        <th>Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="mono">1234 1234 1234 1234</td>
                        <td>12/26</td>
                        <td>543</td>
                        <td>Aprobada</td>
                      </tr>
                      <tr>
                        <td className="mono">5555 0000 0000 0001</td>
                        <td>Futura</td>
                        <td>Cualquiera</td>
                        <td>Fondos insuficientes</td>
                      </tr>
                      <tr>
                        <td className="mono">5555 0000 0000 0002</td>
                        <td>Futura</td>
                        <td>Cualquiera</td>
                        <td>Tarjeta bloqueada</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="muted small">Monto $9,999 o el interruptor de abajo simulan una caída del servicio.</p>
              </details>
            </aside>

            <form
              className="form"
              noValidate
              onSubmit={(e) => void handleSubmit(e)}
              onDragOver={blockFileDrop}
              onDrop={blockFileDrop}
              aria-busy={loading}
            >
              <h2 id="snailpay-title" className="form-title">
                Cargar saldo
              </h2>

              {alert !== null ? (
                <div className="alert alert-error" role="alert">
                  <p>
                    <strong>{alert.tone === 'rejected' ? 'Pago rechazado.' : 'Error del sistema.'}</strong> {alert.message}
                  </p>
                  {alert.code !== null ? <p className="alert-code">Código: {alert.code}</p> : null}
                </div>
              ) : null}

              <FormField
                id="cc-amount"
                label="Monto de la recarga (MXN)"
                prefix="$"
                inputMode="decimal"
                placeholder="0.00"
                value={values.amount}
                onChange={(v) => setField('amount', v.replace(/[^\d.,]/g, ''))}
                onBlur={touch('amount')}
                error={visibleError('amount')}
                hint="Mínimo $0.01, máximo $10,000.00 por recarga."
                maxLength={9}
                disabled={loading}
                inputRef={amountRef}
              />
              <FormField
                id="cc-name"
                label="Nombre completo del titular"
                autoComplete="cc-name"
                maxLength={100}
                value={values.cardholderName}
                onChange={(v) => setField('cardholderName', v)}
                onBlur={touch('cardholderName')}
                error={visibleError('cardholderName')}
                disabled={loading}
              />
              <FormField
                id="cc-number"
                label="Número de tarjeta"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="1234 1234 1234 1234"
                maxLength={19}
                value={values.cardNumber}
                onChange={(v) => setField('cardNumber', formatCardNumber(v))}
                onBlur={touch('cardNumber')}
                error={visibleError('cardNumber')}
                disabled={loading}
              />
              <div className="field-row">
                <FormField
                  id="cc-exp"
                  label="Vencimiento"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM/AA"
                  maxLength={5}
                  value={values.expirationDate}
                  onChange={(v) => setField('expirationDate', formatExpiration(v))}
                  onBlur={touch('expirationDate')}
                  error={visibleError('expirationDate')}
                  disabled={loading}
                />
                <FormField
                  id="cc-cvv"
                  label="CVV"
                  type="password"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder="•••"
                  maxLength={3}
                  value={values.cvv}
                  onChange={(v) => setField('cvv', digitsOnly(v).slice(0, 3))}
                  onBlur={touch('cvv')}
                  error={visibleError('cvv')}
                  disabled={loading}
                />
              </div>

              <label className="toggle">
                <input
                  type="checkbox"
                  checked={simulateError}
                  onChange={(e) => setSimulateError(e.target.checked)}
                  disabled={loading}
                />
                <span>Simular caída del servicio (header x-simulate-error)</span>
              </label>

              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? <Spinner label="Procesando pago…" /> : 'Pagar'}
              </button>
              <p className="muted small center">Entorno de pruebas: usa solo tarjetas ficticias. No se realiza ningún cargo real.</p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default SnailPayModal;
