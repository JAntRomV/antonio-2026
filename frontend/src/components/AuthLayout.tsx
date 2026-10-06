import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  active: 'login' | 'register';
  title: string;
  description: string;
  showHighlights?: boolean;
  children: ReactNode;
}

/** Diseño de dos columnas (hero + tarjeta) compartido por login y registro. */
export function AuthLayout({ active, title, description, showHighlights = false, children }: AuthLayoutProps) {
  return (
    <div className="auth">
      <section className="auth-hero" aria-hidden={false}>
        <div>
          <span className="hero-snail" aria-hidden="true">
            🐌
          </span>
          <h1>{title}</h1>
          <p>{description}</p>
          {showHighlights ? (
            <ul className="hero-points">
              <li>6 caracoles · 6 carreras al día</li>
              <li>Estadísticas de tus apuestas</li>
              <li>Recargas instantáneas con SnailPay</li>
            </ul>
          ) : null}
        </div>
      </section>
      <main className="auth-panel">
        <div className="card auth-card">
          <nav className="tabs" aria-label="Acceso">
            <Link className="tab" to="/login" aria-current={active === 'login' ? 'page' : undefined}>
              Iniciar sesión
            </Link>
            <Link className="tab" to="/registro" aria-current={active === 'register' ? 'page' : undefined}>
              Crear cuenta
            </Link>
          </nav>
          {children}
        </div>
      </main>
    </div>
  );
}
