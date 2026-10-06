import type { BetOutcome, BetStats, Race, Snail, SnailId, SnailWins } from '../types';

/** Los 6 caracoles de la pista, con su color de identificación. */
export const SNAILS: readonly Snail[] = [
  { id: 'turbo', name: 'Turbo Baba', color: '#2f7ed8' },
  { id: 'concha', name: 'Doña Concha', color: '#e8743b' },
  { id: 'rayo', name: 'Rayo Lento', color: '#19a979' },
  { id: 'caracolo', name: 'Sir Caracolo', color: '#945ecf' },
  { id: 'espiral', name: 'La Espiral', color: '#d64e8a' },
  { id: 'chispa', name: 'Chispa Verde', color: '#c9a227' },
];

/** Exactamente 6 carreras efectuadas en el día (datos simulados). */
export const TODAY_RACES: readonly Race[] = [
  { number: 1, time: '10:00', winnerId: 'turbo', durationSeconds: 161, betSnailId: 'turbo' },
  { number: 2, time: '11:30', winnerId: 'concha', durationSeconds: 182, betSnailId: 'turbo' },
  { number: 3, time: '13:00', winnerId: 'turbo', durationSeconds: 155, betSnailId: null },
  { number: 4, time: '14:30', winnerId: 'rayo', durationSeconds: 190, betSnailId: 'concha' },
  { number: 5, time: '16:00', winnerId: 'caracolo', durationSeconds: 198, betSnailId: 'caracolo' },
  { number: 6, time: '17:30', winnerId: 'espiral', durationSeconds: 206, betSnailId: 'turbo' },
];

/** Apuestas simuladas de los últimos 7 días. */
export const WEEKLY_BET_STATS: BetStats = { won: 11, lost: 19 };

export function getSnail(id: SnailId): Snail {
  const snail = SNAILS.find((s) => s.id === id);
  if (snail === undefined) throw new Error(`Caracol desconocido: ${id}`);
  return snail;
}

export function betOutcome(race: Race): BetOutcome {
  if (race.betSnailId === null) return 'none';
  return race.betSnailId === race.winnerId ? 'won' : 'lost';
}

/**
 * Victorias por caracol derivadas de las carreras del día.
 * Al calcularse a partir de TODAY_RACES, la suma siempre es igual al número de carreras.
 */
export function winsBySnail(races: readonly Race[] = TODAY_RACES): SnailWins[] {
  return SNAILS.map((snail) => ({
    id: snail.id,
    name: snail.name,
    color: snail.color,
    wins: races.filter((race) => race.winnerId === snail.id).length,
  }));
}
