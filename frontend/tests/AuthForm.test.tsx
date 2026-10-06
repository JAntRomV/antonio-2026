import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';
import { STORAGE_KEYS } from '../src/services/authService';
import type { StoredUser } from '../src/types';
import { MESSAGES, parseAmount, validateLogin, validatePayment, validateRegister } from '../src/utils/validation';
import { formatCardNumber, formatExpiration } from '../src/utils/format';

const VALID = {
  fullName: 'Ana María López',
  email: 'ana@example.com',
  password: 'Caracol123',
};

function renderApp(initialPath: string) {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
  return user;
}

function readStoredUsers(): Record<string, StoredUser> {
  const raw = localStorage.getItem(STORAGE_KEYS.users);
  return raw === null ? {} : (JSON.parse(raw) as Record<string, StoredUser>);
}

async function fillRegister(
  user: ReturnType<typeof userEvent.setup>,
  values: { fullName: string; email: string; password: string; confirm: string },
) {
  if (values.fullName !== '') await user.type(screen.getByLabelText('Nombre completo'), values.fullName);
  if (values.email !== '') await user.type(screen.getByLabelText('Correo electrónico'), values.email);
  if (values.password !== '') await user.type(screen.getByLabelText('Contraseña'), values.password);
  if (values.confirm !== '') await user.type(screen.getByLabelText('Confirmar contraseña'), values.confirm);
}

async function registerThroughUi(user: ReturnType<typeof userEvent.setup>) {
  await fillRegister(user, { ...VALID, confirm: VALID.password });
  await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  await screen.findByRole('heading', { name: `Hola, ${VALID.fullName}` });
}

/* ------------------------------------------------------------------ */
/* Validaciones puras                                                  */
/* ------------------------------------------------------------------ */
describe('validaciones de formularios', () => {
  it('validateRegister acepta datos correctos', () => {
    expect(validateRegister({ ...VALID, confirmPassword: VALID.password })).toEqual({});
  });

  it('validateRegister detecta campos obligatorios', () => {
    const errors = validateRegister({ fullName: '', email: '', password: '', confirmPassword: '' });
    expect(errors).toEqual({
      fullName: MESSAGES.nameRequired,
      email: MESSAGES.emailRequired,
      password: MESSAGES.passwordRequired,
      confirmPassword: MESSAGES.confirmRequired,
    });
  });

  it.each(['ana', 'ana@', 'ana@dominio', 'ana dominio.com', '@dominio.com'])('rechaza el correo "%s"', (email) => {
    expect(validateRegister({ ...VALID, email, confirmPassword: VALID.password }).email).toBe(MESSAGES.emailInvalid);
  });

  it.each(['corta1A', 'sinnumeros', 'SINMINUS123', 'sinmayus123'])('rechaza la contraseña débil "%s"', (password) => {
    expect(validateRegister({ ...VALID, password, confirmPassword: password }).password).toBe(MESSAGES.passwordWeak);
  });

  it('exige nombre y apellido', () => {
    expect(validateRegister({ ...VALID, fullName: 'Ana', confirmPassword: VALID.password }).fullName).toBe(
      MESSAGES.nameInvalid,
    );
  });

  it('validateRegister detecta contraseñas que no coinciden', () => {
    expect(validateRegister({ ...VALID, confirmPassword: 'Caracol124' }).confirmPassword).toBe(MESSAGES.confirmMismatch);
  });

  it('validateLogin exige correo válido y contraseña', () => {
    expect(validateLogin({ email: 'x', password: '' })).toEqual({
      email: MESSAGES.emailInvalid,
      password: MESSAGES.passwordRequired,
    });
  });

  it('validatePayment y parseAmount validan monto, tarjeta, vencimiento y CVV', () => {
    expect(parseAmount('500')).toBe(500);
    expect(parseAmount('10.5')).toBe(10.5);
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('10.555')).toBeNull();
    expect(parseAmount('10001')).toBeNull();
    expect(
      validatePayment({ amount: '', cardholderName: ' ', cardNumber: '1234', expirationDate: '13/26', cvv: '12' }),
    ).toEqual({
      amount: MESSAGES.amountInvalid,
      cardholderName: MESSAGES.holderRequired,
      cardNumber: MESSAGES.cardInvalid,
      expirationDate: MESSAGES.expInvalid,
      cvv: MESSAGES.cvvInvalid,
    });
    expect(formatCardNumber('1234123412341234999')).toBe('1234 1234 1234 1234');
    expect(formatExpiration('1226')).toBe('12/26');
  });
});

/* ------------------------------------------------------------------ */
/* Formulario de registro                                              */
/* ------------------------------------------------------------------ */
describe('RegisterPage', () => {
  it('muestra errores de campos obligatorios al enviar vacío y no crea usuario', async () => {
    const user = renderApp('/registro');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(screen.getByText(MESSAGES.nameRequired)).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.emailRequired)).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.passwordRequired)).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.confirmRequired)).toBeInTheDocument();
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');
    expect(readStoredUsers()).toEqual({});
  });

  it('valida el formato del correo al salir del campo', async () => {
    const user = renderApp('/registro');
    await user.type(screen.getByLabelText('Correo electrónico'), 'correo-invalido');
    await user.tab();
    expect(screen.getByText(MESSAGES.emailInvalid)).toBeInTheDocument();
  });

  it('valida que las contraseñas coincidan', async () => {
    const user = renderApp('/registro');
    await fillRegister(user, { ...VALID, confirm: 'Caracol999' });
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(screen.getByText(MESSAGES.confirmMismatch)).toBeInTheDocument();
    expect(readStoredUsers()).toEqual({});
  });

  it('no incluye campos de archivo (no se permiten adjuntos)', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/registro']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it('registra al usuario con saldo $0, sin guardar la contraseña en claro, y entra al dashboard', async () => {
    const user = renderApp('/registro');
    await registerThroughUi(user);

    const stored = readStoredUsers()[VALID.email];
    expect(stored).toBeDefined();
    expect(stored?.balance).toBe(0);
    expect(stored?.fullName).toBe(VALID.fullName);
    expect(stored?.passwordHash).toMatch(/^[0-9a-f]{64}$/);
    expect(localStorage.getItem(STORAGE_KEYS.users)).not.toContain(VALID.password);
    expect(localStorage.getItem(STORAGE_KEYS.session)).not.toBeNull();
    expect(screen.getByTestId('balance-amount')).toHaveTextContent('$0.00');
  });

  it('impide registrar dos veces el mismo correo', async () => {
    const user = renderApp('/registro');
    await registerThroughUi(user);
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await user.click(await screen.findByRole('link', { name: 'Crear cuenta' }));

    await fillRegister(user, { ...VALID, email: 'ANA@example.com', confirm: VALID.password });
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Ya existe una cuenta registrada con este correo.')).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/* Login, logout y ruta protegida                                      */
/* ------------------------------------------------------------------ */
describe('LoginPage y sesión', () => {
  it('redirige al login cuando no hay sesión e intenta abrir el dashboard', () => {
    renderApp('/dashboard');
    expect(screen.getByRole('heading', { name: 'Bienvenido de vuelta' })).toBeInTheDocument();
  });

  it('muestra errores de validación en login', async () => {
    const user = renderApp('/login');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(screen.getByText(MESSAGES.emailRequired)).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.passwordRequired)).toBeInTheDocument();
  });

  it('flujo completo: registro → logout → login fallido → login correcto', async () => {
    const user = renderApp('/registro');
    await registerThroughUi(user);

    // Logout
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('heading', { name: 'Bienvenido de vuelta' })).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();

    // Credenciales incorrectas
    await user.type(screen.getByLabelText('Correo electrónico'), VALID.email);
    await user.type(screen.getByLabelText('Contraseña'), 'Incorrecta123');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');

    // Credenciales correctas
    await user.type(screen.getByLabelText('Contraseña'), VALID.password);
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('heading', { name: `Hola, ${VALID.fullName}` })).toBeInTheDocument();
  });

  it('restaura la sesión persistida al recargar (nuevo montaje)', async () => {
    const user = renderApp('/registro');
    await registerThroughUi(user);

    // Simula una recarga: se desmonta y vuelve a montar la app leyendo localStorage.
    cleanup();
    renderApp('/dashboard');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: `Hola, ${VALID.fullName}` })).toBeInTheDocument();
    });
  });
});
