import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import type { FieldErrors, RegisterFormValues } from '../types';
import { blockFileDrop } from '../utils/format';
import { hasErrors, validateRegister } from '../utils/validation';

const INITIAL: RegisterFormValues = { fullName: '', email: '', password: '', confirmPassword: '' };

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState<RegisterFormValues>(INITIAL);
  const [touched, setTouched] = useState<Partial<Record<keyof RegisterFormValues, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const errors: FieldErrors<RegisterFormValues> = validateRegister(values);
  const visibleError = (field: keyof RegisterFormValues): string | undefined =>
    submitted || touched[field] === true ? errors[field] : undefined;

  const setField = (field: keyof RegisterFormValues) => (value: string): void => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFormError(null);
  };
  const touch = (field: keyof RegisterFormValues) => (): void => setTouched((prev) => ({ ...prev, [field]: true }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors(errors) || loading) return;

    setLoading(true);
    const result = await register({ fullName: values.fullName, email: values.email, password: values.password });
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <AuthLayout
      active="register"
      title="Únete a Snail Racer"
      description="Crea tu cuenta en segundos. Empiezas con un saldo de $0.00 y puedes recargar cuando quieras con SnailPay."
    >
      <form
        className="form"
        noValidate
        aria-label="Crear cuenta"
        onSubmit={(e) => void handleSubmit(e)}
        onDragOver={blockFileDrop}
        onDrop={blockFileDrop}
      >
        <h2 className="form-title">Crea tu cuenta</h2>

        {formError !== null ? (
          <div className="alert alert-error" role="alert">
            <p>{formError}</p>
          </div>
        ) : null}

        <FormField
          id="reg-name"
          label="Nombre completo"
          autoComplete="name"
          maxLength={80}
          value={values.fullName}
          onChange={setField('fullName')}
          onBlur={touch('fullName')}
          error={visibleError('fullName')}
          hint="Nombre y apellido."
          disabled={loading}
        />
        <FormField
          id="reg-email"
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
          id="reg-password"
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          maxLength={128}
          value={values.password}
          onChange={setField('password')}
          onBlur={touch('password')}
          error={visibleError('password')}
          hint="Mínimo 8 caracteres, con mayúsculas, minúsculas y al menos un número."
          disabled={loading}
        />
        <FormField
          id="reg-confirm"
          label="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
          maxLength={128}
          value={values.confirmPassword}
          onChange={setField('confirmPassword')}
          onBlur={touch('confirmPassword')}
          error={visibleError('confirmPassword')}
          hint="Debe coincidir con la contraseña."
          disabled={loading}
        />

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <Spinner label="Creando cuenta…" /> : 'Crear cuenta'}
        </button>
        <p className="form-foot">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default RegisterPage;
