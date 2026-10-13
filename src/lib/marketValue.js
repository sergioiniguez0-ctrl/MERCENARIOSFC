import { isScoringAward } from "./recognitions.js";
// ---------- Valor Mercenario (v3.2 — corregido) ----------
// Sigue siendo 100% independiente del Puntaje/Promedio existente en App.jsx (no se
// importa nada de acá desde ese cálculo, y este módulo no toca la constante base
// del Puntaje ni los topes de esa fórmula (viven solo en App.jsx). Es una función pura sobre `players` + `matches` +
// `votes`: no agrega colecciones ni campos nuevos en Firestore.
//
// CORRECCIÓN v3.2 (pedida tras revisar v3.1):
// Antes, el valor era una suma que solo podía crecer con buen rendimiento, así que
// con suficientes partidos buenos cualquier jugador terminaba en 10 M. Ahora se
// calcula un "valor objetivo" en cada fecha (rendimiento reciente + trayectoria +
// cantidad de partidos como confianza + rendimiento relativo a la posición + goles/
// asistencias ponderados + reconocimientos) y la cotización actual se mueve hacia
// ese objetivo, como máximo ±0,5 M por fecha. Si el objetivo no sigue subiendo, el
// valor deja de subir — no hay ningún camino que lleve "automáticamente" a 10 M.

import { POSITION_COEFFICIENTS, coefficientsFor, posGroupOf, posGroupLabel, teamGoalsFor } from "./sportsConfig.js";

// ---------- 1) Coeficientes por posición ----------
// v3.3: la fuente de los coeficientes ahora vive en sportsConfig.js, compartida
// con el Puntaje (App.jsx -> matchRating). Se re-exporta acá con el nombre
// anterior por compatibilidad, por si algo del proyecto todavía lo importa así.
export const POSITION_MARKET_COEFFICIENTS = POSITION_COEFFICIENTS;

// ---------- 2) Configuración general (un solo lugar para ajustar todo) ----------
export const MARKET_VALUE_CONFIG = {
  MIN: 1,
  MAX: 10,
  BASE: 5.5, // punto neutro: valor de arranque antes del primer partido oficial
  MAX_MOVE_PER_MATCH: 0.5, // tope absoluto: ninguna fecha mueve más que esto
  RECENT_WINDOW: 5, // "rendimiento reciente" = últimas 5 fechas oficiales
  CONFIDENCE_FULL_MATCHES: 10, // partidos oficiales para tener confianza plena (100%)
  BUDGET_TOLERANCE: 2, // tolerancia (en M) para el presupuesto dinámico (etapa 8)
};

// v3.2: solo partidos OFICIALES (Fútbol 8 y Fútbol 9) modifican la cotización.
// Fútbol 5 y 6 siguen contando para el Compromiso (commitment.js), pero acá se
// ignoran por completo — ni suman ni restan valor.
export const OFFICIAL_MARKET_MODES = ["Fútbol 8", "Fútbol 9"];
function isOfficialMode(mode) {
  return OFFICIAL_MARKET_MODES.includes(mode);
}

// Pesos para combinar los factores del "valor objetivo". No son la variación en M
// todavía — son puntos de rendimiento en una escala interna que después se pasa
// por una función acotada (ver computeTargetValue) para nunca salir de 1-10 M.
const TARGET_WEIGHTS = {
  recent: 0.5, // rendimiento reciente (últimas 5 fechas), con más peso
  trajectory: 0.3, // trayectoria histórica completa, como estabilizador
  relative: 0.2, // rendimiento relativo a jugadores de la misma posición
};
const PERFORMANCE_WEIGHTS = {
  goal: 0.35, // se multiplica además por el coeficiente de la posición
  assist: 0.22,
  win: 0.12,
  loss: -0.08,
  cleanSheet: 0.15, // solo ARQ/DEF, sin goles del rival — clave para valorar defensores
  award: 0.2, // reconocimiento subjetivo del grupo
  vote: 0.06,
  voteCap: 3,
  ownGoal: -0.35,
};
const TARGET_NORM = 1.1; // controla qué tan rápido el objetivo se acerca a 1 o 10 M

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function stdDev(arr, mean) {
  if (arr.length < 2) return 0;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

// teamGoalsFor ahora se importa de sportsConfig.js (ver encabezado del archivo).

// Puntaje de rendimiento de UN jugador en UN partido oficial, ponderado por su
// posición. Es un número interno (no se muestra), insumo del valor objetivo.
function matchPerformanceScore(match, participant, mvpVotes) {
  const coef = coefficientsFor(participant.position);
  const goals = Number(participant.goals) || 0;
  const assists = Number(participant.assists) || 0;
  const ownGoals = Number(participant.ownGoals) || 0;
  const teamGoals = teamGoalsFor(match, participant.team);
  const rivalGoals = teamGoalsFor(match, participant.team === "A" ? "B" : "A");
  const win = teamGoals > rivalGoals;
  const loss = teamGoals < rivalGoals;
  const group = posGroupOf(participant.position);
  const cleanSheet = (group === "ARQ" || group === "DEF") && rivalGoals === 0;
  const awardsCount = (match.awards || []).filter((a) => a.playerId === participant.playerId && isScoringAward(a)).length;
  const votesCount = mvpVotes ? Object.values(mvpVotes).filter((v) => v === participant.playerId).length : 0;
  const cappedVotes = Math.min(votesCount, PERFORMANCE_WEIGHTS.voteCap);

  let score = 0;
  const matchReasons = [];
  if (goals > 0) {
    score += goals * coef.goal * PERFORMANCE_WEIGHTS.goal;
    matchReasons.push(`${goals} gol${goals > 1 ? "es" : ""}`);
  }
  if (assists > 0) {
    score += assists * coef.assist * PERFORMANCE_WEIGHTS.assist;
    matchReasons.push(`${assists} asistencia${assists > 1 ? "s" : ""}`);
  }
  if (win) {
    score += PERFORMANCE_WEIGHTS.win;
    matchReasons.push("victoria");
  } else if (loss) {
    score += PERFORMANCE_WEIGHTS.loss;
  }
  if (cleanSheet) {
    score += PERFORMANCE_WEIGHTS.cleanSheet;
    matchReasons.push("valla invicta");
  }
  if (awardsCount > 0) {
    score += awardsCount * PERFORMANCE_WEIGHTS.award;
    matchReasons.push(awardsCount > 1 ? `${awardsCount} reconocimientos` : "reconocimiento del grupo");
  }
  if (cappedVotes > 0) {
    score += cappedVotes * PERFORMANCE_WEIGHTS.vote;
    matchReasons.push("votos a figura");
  }
  if (ownGoals > 0) {
    score += ownGoals * PERFORMANCE_WEIGHTS.ownGoal;
    matchReasons.push(ownGoals > 1 ? `${ownGoals} goles en contra` : "gol en contra");
  }
  return { score, group, matchReasons };
}

// Recorre TODO el historial OFICIAL del plantel en orden cronológico y devuelve la
// cotización completa de UN jugador. Necesita `players`/`matches` completos (no
// solo los del jugador) porque el "rendimiento relativo a la posición" se compara
// contra sus compañeros de línea en cada fecha.
export function computeMarketValue(player, players, matches, votes) {
  const official = [...(matches || [])]
    .filter((m) => isOfficialMode(m.mode))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));

  // Historial de rendimiento de CADA jugador, acumulado a medida que se recorren
  // las fechas — así, en cualquier punto del recorrido, solo se usan datos "hasta
  // ese momento" (sin mirar el futuro).
  const perfHistory = {};
  (players || []).forEach((p) => (perfHistory[p.id] = []));

  let value = MARKET_VALUE_CONFIG.BASE;
  let maxHistoric = value;
  let minHistoric = value;
  const history = [];

  official.forEach((match) => {
    // Paso 1: registrar el rendimiento de ESTE partido para todos los que jugaron
    // (necesario para que la comparación "relativa a la posición" de cualquier
    // jugador, en fechas futuras, tenga en cuenta a todo el plantel).
    match.participants.forEach((part) => {
      if (!(part.playerId in perfHistory)) perfHistory[part.playerId] = [];
      const { score, group } = matchPerformanceScore(match, part, votes ? votes[match.id] : undefined);
      perfHistory[part.playerId].push({ date: match.date, score, group });
    });

    const played = match.participants.find((p) => p.playerId === player.id);
    if (!played) return; // ausencia: no hay impacto, ni positivo ni negativo

    const myHistory = perfHistory[player.id];
    const matchesSoFar = myHistory.length;
    const myGroup = myHistory[myHistory.length - 1].group;

    const recentSlice = myHistory.slice(-MARKET_VALUE_CONFIG.RECENT_WINDOW);
    const recentAvg = average(recentSlice.map((h) => h.score));
    const careerAvg = average(myHistory.map((h) => h.score));

    // Rendimiento relativo a la posición: promedio de carrera (hasta esta fecha)
    // de cada jugador del mismo grupo de línea, comparado con este jugador.
    const groupCareerAverages = [];
    Object.values(perfHistory).forEach((hist) => {
      const groupEntries = hist.filter((h) => h.group === myGroup);
      if (groupEntries.length === 0) return;
      groupCareerAverages.push(average(groupEntries.map((e) => e.score)));
    });
    const groupMean = average(groupCareerAverages);
    const groupStd = stdDev(groupCareerAverages, groupMean);
    const relative = groupStd > 0.0001 ? clamp((careerAvg - groupMean) / groupStd, -2, 2) : 0;

    // Confianza estadística: con pocos partidos, el objetivo se "amortigua" hacia
    // el valor neutro — así 1-2 fechas espectaculares no disparan la cotización.
    const confidence = Math.min(1, matchesSoFar / MARKET_VALUE_CONFIG.CONFIDENCE_FULL_MATCHES);

    const rawTarget =
      TARGET_WEIGHTS.recent * recentAvg + TARGET_WEIGHTS.trajectory * careerAvg + TARGET_WEIGHTS.relative * relative;
    const dampedTarget = rawTarget * confidence;

    const half = (MARKET_VALUE_CONFIG.MAX - MARKET_VALUE_CONFIG.MIN) / 2;
    const mid = MARKET_VALUE_CONFIG.MIN + half;
    const targetValue = clamp(mid + half * Math.tanh(dampedTarget / TARGET_NORM), MARKET_VALUE_CONFIG.MIN, MARKET_VALUE_CONFIG.MAX);

    const previousValue = value;
    const step = clamp(targetValue - previousValue, -MARKET_VALUE_CONFIG.MAX_MOVE_PER_MATCH, MARKET_VALUE_CONFIG.MAX_MOVE_PER_MATCH);
    value = clamp(previousValue + step, MARKET_VALUE_CONFIG.MIN, MARKET_VALUE_CONFIG.MAX);
    maxHistoric = Math.max(maxHistoric, value);
    minHistoric = Math.min(minHistoric, value);

    // Motivos, en lenguaje llano: lo que pasó en esta fecha + contexto de objetivo.
    const { matchReasons } = matchPerformanceScore(match, played, votes ? votes[match.id] : undefined);
    const reasons = [...matchReasons];
    if (matchesSoFar < MARKET_VALUE_CONFIG.CONFIDENCE_FULL_MATCHES) {
      reasons.push(`confianza ${matchesSoFar}/${MARKET_VALUE_CONFIG.CONFIDENCE_FULL_MATCHES} partidos`);
    }
    if (relative >= 0.5) reasons.push(`por encima del promedio de su línea (${posGroupLabel(myGroup)})`);
    else if (relative <= -0.5) reasons.push(`por debajo del promedio de su línea (${posGroupLabel(myGroup)})`);
    if (reasons.length === 0) reasons.push("fecha sin estadísticas destacadas");

    history.push({
      matchId: match.id,
      date: match.date,
      value,
      previousValue,
      variation: value - previousValue,
      targetValue,
      reasons,
    });
  });

  const hasHistory = history.length > 0;
  const last = hasHistory ? history[history.length - 1] : null;
  const previous = history.length >= 2 ? history[history.length - 2].value : hasHistory ? MARKET_VALUE_CONFIG.BASE : null;

  return {
    current: hasHistory ? value : null,
    previous,
    lastVariation: last ? last.variation : 0,
    lastReasons: last ? last.reasons : [],
    maxHistoric: hasHistory ? maxHistoric : null,
    minHistoric: hasHistory ? minHistoric : null,
    history,
  };
}

// posGroupLabel ahora se importa de sportsConfig.js (ver encabezado del archivo).

// Formatea el valor con coma decimal (estilo argentino) y sin decimales de sobra:
// 7 -> "7 M", 7.5 -> "7,5 M". Devuelve "—" si todavía no hay cotización (jugador
// sin partidos oficiales jugados).
export function formatMarketValue(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
  return `${text} M`;
}

export function formatMarketVariation(variation) {
  if (variation === null || variation === undefined || Number.isNaN(variation)) return "";
  const rounded = Math.round(variation * 10) / 10;
  if (rounded === 0) return "±0 M";
  const sign = rounded > 0 ? "+" : "−";
  const abs = Math.abs(rounded);
  const text = Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace(".", ",");
  return `${sign}${text} M`;
}

// ---------- 3) Presupuesto dinámico (base para la etapa 8) ----------
export function computeDynamicBudget(totalMarketValue) {
  return { perTeam: totalMarketValue / 2, tolerance: MARKET_VALUE_CONFIG.BUDGET_TOLERANCE };
}

// ---------- 4) Snapshots por fecha (preparado para la Central de la Fecha — etapa 9) ----------
// v3.2, punto 7: esta función arma el snapshot que se guardaría al cerrar una
// fecha, pero TODAVÍA NO SE LLAMA DESDE NINGÚN LADO ni escribe en Firestore. Se
// deja lista para cuando exista la Central de la Fecha (etapa 9): en ese momento,
// al procesar el resultado de un partido oficial, se llamaría a
// `buildMarketValueSnapshot(player, players, matches, votes)` para el último
// partido cargado y se guardaría el resultado como un nuevo documento/entrada en
// Firestore (por ejemplo `mercenarios/shared/marketSnapshots/{matchId}_{playerId}`
// o agregado al propio `players`, a definir en esa etapa) — no antes, para no
// escribir datos derivados a medias mientras el proceso de cierre de fecha no
// existe todavía.
export function buildMarketValueSnapshot(player, players, matches, votes) {
  const mv = computeMarketValue(player, players, matches, votes);
  const last = mv.history[mv.history.length - 1] || null;
  if (!last) return null;
  return {
    playerId: player.id,
    matchId: last.matchId,
    date: last.date,
    previousValue: last.previousValue,
    newValue: last.value,
    variation: last.variation,
    targetValue: last.targetValue,
    reasons: last.reasons,
    maxHistoric: mv.maxHistoric,
  };
}
