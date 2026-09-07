// ---------- Puntaje por partido (v3.3) ----------
// Es la MISMA función que usa App.jsx para calcular la Nota/Promedio: se movió acá,
// sin cambiar ni un número de su lógica, únicamente para poder importarla también
// desde un script de pruebas sin necesitar compilar todo App.jsx (que tiene JSX).
// App.jsx importa `computeMatchRating` de este archivo — no hay dos implementaciones
// del Puntaje dando vueltas, solo esta.
import { coefficientsFor, posGroupOf, teamGoalsFor } from "./sportsConfig.js";

export const RATING_CONFIG = {
  BASE: 6,
  GOAL_INC: 1,
  ASSIST_INC: 0.6,
  CLEAN_SHEET_INC: 0.5,
  WIN_INC: 0.5,
  VOTE_INC: 0.5,
  VOTE_CAP: 3,
  AWARD_INC: 0.5,
  OWN_GOAL_DEC: 1,
  MIN: 2,
  MAX: 10,
};

// v3.3: el coeficiente de posición (el mismo que usa el Valor Mercenario, ver
// sportsConfig.js) pondera SOLO los puntos que aportan el gol y la asistencia acá
// adentro. Las estadísticas reales (`goals`, `assists` en el valor devuelto) NO se
// tocan: siguen siendo la cantidad real cargada, tal como se pidió.
export function computeMatchRating(match, playerId, mvpVotes) {
  const p = match.participants.find((x) => x.playerId === playerId);
  if (!p) return null;
  const teamGoals = teamGoalsFor(match, p.team);
  const rivalGoals = teamGoalsFor(match, p.team === "A" ? "B" : "A");
  const goals = Number(p.goals) || 0;
  const assists = Number(p.assists) || 0;
  const ownGoals = Number(p.ownGoals) || 0;
  const win = teamGoals > rivalGoals;
  const pGroup = posGroupOf(p.position);
  const cleanSheet = (pGroup === "ARQ" || pGroup === "DEF") && rivalGoals === 0;
  const votes = mvpVotes ? Object.values(mvpVotes).filter((v) => v === playerId).length : 0;
  const awards = (match.awards || []).filter((a) => a.playerId === playerId);
  const coef = coefficientsFor(p.position);

  let rating = RATING_CONFIG.BASE;
  rating += goals * RATING_CONFIG.GOAL_INC * coef.goal;
  rating += assists * RATING_CONFIG.ASSIST_INC * coef.assist;
  rating += cleanSheet ? RATING_CONFIG.CLEAN_SHEET_INC : 0;
  rating += win ? RATING_CONFIG.WIN_INC : 0;
  rating += Math.min(votes, RATING_CONFIG.VOTE_CAP) * RATING_CONFIG.VOTE_INC;
  rating += awards.length * RATING_CONFIG.AWARD_INC;
  rating -= ownGoals * RATING_CONFIG.OWN_GOAL_DEC;
  rating = Math.min(RATING_CONFIG.MAX, Math.max(RATING_CONFIG.MIN, rating));

  return { rating, goals, assists, ownGoals, votes, awards, win, cleanSheet, teamGoals, rivalGoals };
}
