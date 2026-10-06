import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';
import { STORAGE_KEYS } from '../src/services/authService';
import type { SnailPayResponse } from '../src/types';

const ACCOUNT = { fullName: 'Ana María López', email: 'ana@example.com', password: 'Caracol123' };

function snailPayResponse(overrides: Partial<SnailPayResponse>): SnailPayResponse {
  return {
    id: 'sp_test',
    status: 'approved',
    status_detail: 'accredited',
    transaction_amount: 500,
    date_created: '2026-10-06T17:00:00.000Z',
    authorization_code: '123456',
    reference: 'SR-20261006-TEST',
    payer_id: 'usr_x',
    payer_email: ACCOUNT.email,
    ...overrides,
  };
}

function mockFetch(status: number, body: SnailPayResponse) {
  const fn = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

async function registerAndOpenPayment() {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/registro']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
  await user.type(screen.getByLabelText('Nombre completo'), ACCOUNT.fullName);
  await user.type(screen.getByLabelText('Correo electrónico'), ACCOUNT.email);
  await user.type(screen.getByLabelText('Contraseña'), ACCOUNT.password);
  await user.type(screen.getByLabelText('Confirmar contraseña'), ACCOUNT.password);
  await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  await user.click(await screen.findByRole('button', { name: /Cargar saldo con SnailPay/ }));
  const dialog = screen.getByRole('dialog');
  return { user, dialog };
}

async function fillCard(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  card: { amount: string; number: string; exp: string; cvv: string },
) {
  const q = within(dialog);
  await user.type(q.getByLabelText('Monto de la recarga (MXN)'), card.amount);
  await user.type(q.getByLabelText('Número de tarjeta'), card.number);
  await user.type(q.getByLabelText('Vencimiento'), card.exp);
  await user.type(q.getByLabelText('CVV'), card.cvv);
  await user.click(q.getByRole('button', { name: 'Pagar' }));
}

function storedBalance(): number | undefined {
  const raw = localStorage.getItem(STORAGE_KEYS.users);
  if (raw === null) return undefined;
  return (JSON.parse(raw) as Record<string, { balance: number }>)[ACCOUNT.email]?.balance;
}

describe('SnailPayModal', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('valida los campos de pago antes de llamar al API', async () => {
    const fetchMock = mockFetch(201, snailPayResponse({}));
    const { user, dialog } = await registerAndOpenPayment();
    await user.click(within(dialog).getByRole('button', { name: 'Pagar' }));

    expect(within(dialog).getByText(/Ingresa un monto mayor a \$0/)).toBeInTheDocument();
    expect(within(dialog).getByText('El número de tarjeta debe tener 16 dígitos.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pago aprobado: suma el saldo, lo persiste y no guarda datos de tarjeta', async () => {
    const fetchMock = mockFetch(201, snailPayResponse({}));
    const { user, dialog } = await registerAndOpenPayment();
    await fillCard(user, dialog, { amount: '500', number: '1234123412341234', exp: '1226', cvv: '543' });

    expect(await within(dialog).findByRole('heading', { name: 'Pago aprobado' })).toBeInTheDocument();
    expect(screen.getByTestId('balance-amount')).toHaveTextContent('$500.00');
    expect(screen.getByTestId('topbar-balance')).toHaveTextContent('$500.00');
    expect(storedBalance()).toBe(500);

    const sentBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(sentBody).toMatchObject({ card_number: '1234123412341234', expiration_date: '12/26', transaction_amount: 500 });
    const storageDump = JSON.stringify({ ...localStorage });
    expect(storageDump).not.toContain('1234123412341234');
    expect(storageDump).not.toContain('"543"');
  });

  it('pago rechazado: muestra el motivo y el saldo no cambia', async () => {
    mockFetch(201, snailPayResponse({ status: 'rejected', status_detail: 'cc_rejected_insufficient_amount', authorization_code: undefined }));
    const { user, dialog } = await registerAndOpenPayment();
    await fillCard(user, dialog, { amount: '200', number: '5555000000000001', exp: '1228', cvv: '111' });

    const alert = await within(dialog).findByText(/no tiene fondos suficientes/);
    expect(alert).toBeInTheDocument();
    expect(within(dialog).getByText('Código: cc_rejected_insufficient_amount')).toBeInTheDocument();
    expect(screen.getByTestId('balance-amount')).toHaveTextContent('$0.00');
    expect(storedBalance()).toBe(0);
  });

  it('error del sistema (HTTP 500): informa el fallo y mantiene el saldo', async () => {
    const fetchMock = mockFetch(500, snailPayResponse({ status: 'error', status_detail: 'service_unavailable', authorization_code: undefined }));
    const { user, dialog } = await registerAndOpenPayment();
    await user.click(within(dialog).getByLabelText(/Simular caída del servicio/));
    await fillCard(user, dialog, { amount: '100', number: '1234123412341234', exp: '1226', cvv: '543' });

    expect(await within(dialog).findByText(/SnailPay no está disponible/)).toBeInTheDocument();
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['x-simulate-error']).toBe('true');
    expect(storedBalance()).toBe(0);
  });

  it('error de red: captura la excepción y mantiene el saldo', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => Promise.reject(new TypeError('Failed to fetch'))));
    const { user, dialog } = await registerAndOpenPayment();
    await fillCard(user, dialog, { amount: '100', number: '1234123412341234', exp: '1226', cvv: '543' });

    expect(await within(dialog).findByText(/No pudimos conectar con SnailPay/)).toBeInTheDocument();
    expect(storedBalance()).toBe(0);
  });
});
