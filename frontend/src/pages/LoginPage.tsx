import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import type { RedirectState } from '../components/ProtectedRoute';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import type { FieldErrors, LoginFormValues } from '../types';
import { blockFileDrop } from '../utils/format';
import { hasErrors, validateLogin } from '../utils/validation';

const INITIAL: LoginFormValues = { email: '', password: '' };

function readRedirect(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state) {
    const from = (state as RedirectState).from;
    if (typeof from === 'string' && from.startsWith('/') && from !== '/login') return from;
  }
  return '/dashboard';
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [values, setValues] = useState<LoginFormValues>(INITIAL);
  const [touched, setTouched] = useState<Partial<Record<keyof LoginFormValues, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const errors: FieldErrors<LoginFormValues> = validateLogin(values);
  const visibleError = (field: keyof LoginFormValues): string | undefined =>
    submitted || touched[field] === true ? errors[field] : undefined;

  const setField = (field: keyof LoginFormValues) => (value: string): void => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFormError(null);
  };
  const touch = (field: keyof LoginFormValues) => (): void => setTouched((prev) => ({ ...prev, [field]: true }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors(errors) || loading) return;

    setLoading(true);
    const result = await login({ email: values.email, password: values.password });
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      setValues((prev) => ({ ...prev, password: '' }));
      setSubmitted(false);
      setTouched({});
      return;
    }
    navigate(readRedirect(location.state), { replace: true });
  };

  return (
    <AuthLayout
      active="login"
      title="Snail Racer"
      description="La emoción de las carreras más lentas del mundo. Sigue a tus caracoles favoritos, revisa tus apuestas y recarga saldo con SnailPay."
      showHighlights
    >
      <form
        className="form"
        noValidate
        aria-label="Iniciar sesión"
        onSubmit={(e) => void handleSubmit(e)}
        onDragOver={blockFileDrop}
        onDrop={blockFileDrop}
      >
        <h2 className="form-title">Bienvenido de vuelta</h2>

        {formError !== null ? (
          <div className="alert alert-error" role="alert">
            <p>{formError}</p>
          </div>
        ) : null}

        <FormField
          id="login-email"
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          value={values.email}
          onChange={setField('email')}
          onBlur={touch('email')}
          error={visibleError('email')}
          disabled={loading}
        />
        <FormField
          id="login-password"
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          value={values.password}
          onChange={setField('password')}
          onBlur={touch('password')}
          error={visibleError('password')}
          disabled={loading}
        />

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <Spinner label="Verificando…" /> : 'Iniciar sesión'}
        </button>
        <p className="form-foot">
          ¿No tienes cuenta? <Link to="/registro">Regístrate</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default LoginPage;
