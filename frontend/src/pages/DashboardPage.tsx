import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BetsDonutChart } from '../components/BetsDonutChart';
import { RacesBarChart } from '../components/RacesBarChart';
import { SnailPayModal } from '../components/SnailPayModal';
import { useAuth } from '../context/AuthContext';
import { TODAY_RACES, WEEKLY_BET_STATS, betOutcome, getSnail, winsBySnail } from '../data/mockData';
import type { BetOutcome, SnailId, SnailPayResponse } from '../types';
import { formatCurrency, formatDuration, formatToday } from '../utils/format';

const OUTCOME_BADGE: Record<BetOutcome, { className: string; label: string }> = {
  won: { className: 'badge badge-won', label: 'Ganada' },
  lost: { className: 'badge badge-lost', label: 'Perdida' },
  none: { className: 'badge', label: 'Sin apuesta' },
};

const TOAST_MS = 6000;

function SnailTag({ id }: { id: SnailId }) {
  const snail = getSnail(id);
  return (
    <>
      <span className="dot" style={{ background: snail.color }} />
      {snail.name}
    </>
  );
}

export function DashboardPage() {
  const { user, logout, creditBalance } = useAuth();
  const navigate = useNavigate();
  const [payOpen, setPayOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const wins = winsBySnail(TODAY_RACES);
  const totalWins = wins.reduce((sum, item) => sum + item.wins, 0);

  useEffect(() => {
    if (toast === null) return undefined;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleApproved = useCallback(
    (response: SnailPayResponse): void => {
      const updated = creditBalance(response.transaction_amount);
      if (updated !== null) {
        setToast(
          `Recarga de ${formatCurrency(response.transaction_amount)} aprobada. Nuevo saldo: ${formatCurrency(updated.balance)}.`,
        );
      }
    },
    [creditBalance],
  );

  const handleLogout = (): void => {
    logout();
    navigate('/login', { replace: true });
  };

  // ProtectedRoute garantiza la sesión; este guard solo satisface al tipado.
  if (user === null) return null;

  return (
    <>
      <header className="topbar">
        <span className="brand">
          <span aria-hidden="true">🐌</span>
          <span>Snail Racer</span>
        </span>
        <div className="topbar-right">
          <div className="chip-balance" aria-live="polite">
            <small>Saldo</small>
            <strong data-testid="topbar-balance">{formatCurrency(user.balance)}</strong>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout} aria-label="Cerrar sesión">
            <span aria-hidden="true">⎋</span> <span className="hide-sm">Cerrar sesión</span>
          </button>
        </div>
      </header>

      <main className="container">
        <div className="dash-head">
          <p className="muted">{formatToday()}</p>
          <h1>Hola, {user.fullName}</h1>
        </div>

        {toast !== null ? (
          <div className="toast" role="status">
            <span aria-hidden="true">✓</span>
            <p>{toast}</p>
            <button type="button" className="icon-btn" onClick={() => setToast(null)} aria-label="Cerrar aviso">
              ✕
            </button>
          </div>
        ) : null}

        <div className="grid">
          <article className="card balance-card">
            <p className="muted">
              <strong>Saldo disponible</strong>
            </p>
            <p className="balance-amount" data-testid="balance-amount">
              {formatCurrency(user.balance)}
            </p>
            <p className="muted small">{user.email}</p>
            <button type="button" className="btn btn-primary" onClick={() => setPayOpen(true)}>
              ＋ Cargar saldo con SnailPay
            </button>
          </article>

          <article className="card">
            <header className="card-head">
              <h2>Tus apuestas</h2>
              <span className="pill">Últimos 7 días</span>
            </header>
            <BetsDonutChart stats={WEEKLY_BET_STATS} />
          </article>

          <article className="card span-2">
            <header className="card-head">
              <h2>Victorias del día</h2>
              <span className="pill">
                {TODAY_RACES.length} carreras · {totalWins} victorias
              </span>
            </header>
            <RacesBarChart data={wins} />
          </article>

          <article className="card span-2">
            <header className="card-head">
              <h2>Carreras de hoy</h2>
              <span className="pill">Pista de 30 cm</span>
            </header>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Hora</th>
                    <th scope="col">Ganador</th>
                    <th scope="col">Tiempo</th>
                    <th scope="col">Tu apuesta</th>
                    <th scope="col">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {TODAY_RACES.map((race) => {
                    const badge = OUTCOME_BADGE[betOutcome(race)];
                    return (
                      <tr key={race.number}>
                        <td>{race.number}</td>
                        <td>{race.time}</td>
                        <td>
                          <SnailTag id={race.winnerId} />
                        </td>
                        <td>{formatDuration(race.durationSeconds)}</td>
                        <td className={race.betSnailId === null ? 'muted' : undefined}>
                          {race.betSnailId === null ? '—' : <SnailTag id={race.betSnailId} />}
                        </td>
                        <td>
                          <span className={badge.className}>{badge.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        </div>
        <p className="disclaimer">Los datos de carreras y apuestas son simulados con fines de demostración.</p>
      </main>

      <SnailPayModal open={payOpen} user={user} onClose={() => setPayOpen(false)} onApproved={handleApproved} />
    </>
  );
}

export default DashboardPage;
