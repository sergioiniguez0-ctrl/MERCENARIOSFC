// ---------- Misiones Secretas — motor puro (v3.6 — etapa 6, corregido) ----------
// Este archivo contiene SOLO lógica pura y sincrónica: el catálogo, los
// verificadores y la construcción de "hechos" por fecha (goles, presencia,
// rachas, etc.). No decide CUÁNDO se asigna una misión ni la persiste — eso
// vive en `secretMissionsStore.js`, que es asíncrono y habla con
// `window.storage`/Firestore. Separar las dos cosas es lo que permite testear
// todo esto con Node puro, sin un navegador ni Firestore de por medio.
//
// CORRECCIÓN v3.6 (respecto a la versión anterior, rechazada):
// - Ya NO se generan misiones "hacia atrás" para partidos históricos. Este
//   archivo ya no expone ninguna función que arme un historial retroactivo.
//   La asignación real vive en secretMissionsStore.js y solo puede crear un
//   registro para una fecha que se procesa a través de esa API — ver ese
//   archivo para el motivo exacto de por qué no hay asignaciones anteriores.
// - Las rachas (SCORE_STREAK, ASSIST_STREAK, WIN_STREAK, PRESENCE_STREAK,
//   CLEAN_SHEET_STREAK) ahora recorren el calendario oficial COMPLETO del
//   plantel en orden cronológico, no solo los partidos del jugador: una
//   ausencia corta la racha, tal como se pidió.
// - Se agregaron los tipos CLEAN_SHEET_STREAK, VOTE_COUNT (parametrizable) y
//   ASSIST_AFTER_DROUGHT (con la sequía definida explícitamente), y se
//   corrigieron las misiones que los usaban mal.
// - Se reescribieron los textos que atribuían acciones no registradas
//   ("ganó gracias a lo suyo", "puso el cuerpo atrás"): ahora todas las
//   descripciones y textos de revelación usan solo datos que la app guarda.
import { isOfficialMode, posGroupOf, teamGoalsFor } from "./sportsConfig.js";

export const MISSIONS_CATALOG_VERSION = "v3.6";

// ---------- Tipos de condición (el "motor") ----------
export const MISSION_TYPES = {
  GOAL_AND_ASSIST: "GOAL_AND_ASSIST",
  MULTI_GOAL: "MULTI_GOAL",
  MULTI_ASSIST: "MULTI_ASSIST",
  GOAL_PARTICIPATION_TOTAL: "GOAL_PARTICIPATION_TOTAL",
  SCORE_STREAK: "SCORE_STREAK",
  ASSIST_STREAK: "ASSIST_STREAK",
  ASSIST_AFTER_DROUGHT: "ASSIST_AFTER_DROUGHT",
  FIRST_AWARD: "FIRST_AWARD",
  VOTE_COUNT: "VOTE_COUNT",
  DOUBLE_AWARD: "DOUBLE_AWARD",
  PRESENCE_STREAK: "PRESENCE_STREAK",
  RETURN_CONTRIBUTION: "RETURN_CONTRIBUTION",
  TEAM_WIN: "TEAM_WIN",
  WIN_STREAK: "WIN_STREAK",
  CLEAN_SHEET: "CLEAN_SHEET",
  CLEAN_SHEET_STREAK: "CLEAN_SHEET_STREAK",
  GOAL_AND_WIN: "GOAL_AND_WIN",
  ASSIST_AND_WIN: "ASSIST_AND_WIN",
  WIN_WITHOUT_PERSONAL_STATS: "WIN_WITHOUT_PERSONAL_STATS",
  CLEAN_SHEET_WIN_WITHOUT_STATS: "CLEAN_SHEET_WIN_WITHOUT_STATS",
  AWARD_AND_PARTICIPATION: "AWARD_AND_PARTICIPATION",
  PERFECT_MATCH: "PERFECT_MATCH",
};

// ---------- Construcción de hechos: TODO el calendario oficial del plantel ----------
// Orden canónico de partidos oficiales: por fecha y, a igualdad de fecha, por
// ID. Se usa tanto acá como en secretMissionsStore.js — un solo lugar que
// decide el orden cronológico.
export function sortOfficialMatches(matches) {
  return [...(matches || [])].sort(
    (a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id))
  );
}

// `allOfficial` son TODOS los partidos oficiales (F8/F9) del plantel. Se
// ordenan por fecha ACÁ ADENTRO (no se confía en el orden de entrada) antes de
// calcular nada — así ninguna racha se arma mal por partidos fuera de orden.
export function buildSquadFacts(allOfficial, playerId, votes) {
  const sorted = sortOfficialMatches(allOfficial);
  return sorted.map((match) => {
    const participant = match.participants.find((p) => p.playerId === playerId);
    if (!participant) return { match, played: false };
    const teamGoals = teamGoalsFor(match, participant.team);
    const rivalGoals = teamGoalsFor(match, participant.team === "A" ? "B" : "A");
    const group = posGroupOf(participant.position);
    return {
      match,
      played: true,
      participant,
      goals: Number(participant.goals) || 0,
      assists: Number(participant.assists) || 0,
      win: teamGoals > rivalGoals,
      cleanSheet: (group === "ARQ" || group === "DEF") && rivalGoals === 0,
      awardsCount: (match.awards || []).filter((a) => a.playerId === playerId).length,
      votes: votes && votes[match.id] ? Object.values(votes[match.id]).filter((v) => v === playerId).length : 0,
      group,
    };
  });
}

// Cuenta la racha (según `predicate`) terminando EXACTAMENTE en `idx`, recorriendo
// hacia atrás. Se corta apenas encuentra una fecha no jugada o que no cumple la
// condición — eso es lo que hace que una ausencia rompa la racha.
function streakEndingAt(facts, idx, predicate) {
  let count = 0;
  for (let i = idx; i >= 0; i--) {
    if (facts[i].played && predicate(facts[i])) count++;
    else break;
  }
  return count;
}

// Cada checker recibe (facts, idx, params) donde `facts` es la lista completa
// del calendario del plantel (ver buildSquadFacts) e `idx` es la posición de la
// fecha que se está evaluando. Es la ÚNICA lógica de comprobación que existe:
// el catálogo de abajo solo elige tipo + parámetros por misión.
export const CHECKERS = {
  [MISSION_TYPES.GOAL_AND_ASSIST]: (facts, idx) => facts[idx].goals >= 1 && facts[idx].assists >= 1,
  [MISSION_TYPES.MULTI_GOAL]: (facts, idx, p) => facts[idx].goals >= (p.n || 2),
  [MISSION_TYPES.MULTI_ASSIST]: (facts, idx, p) => facts[idx].assists >= (p.n || 2),
  [MISSION_TYPES.GOAL_PARTICIPATION_TOTAL]: (facts, idx, p) => facts[idx].goals + facts[idx].assists >= (p.n || 2),
  [MISSION_TYPES.SCORE_STREAK]: (facts, idx, p) => streakEndingAt(facts, idx, (f) => f.goals > 0) >= (p.n || 2),
  [MISSION_TYPES.ASSIST_STREAK]: (facts, idx, p) => streakEndingAt(facts, idx, (f) => f.assists > 0) >= (p.n || 2),
  // "Sequía": las `droughtMatches` fechas oficiales INMEDIATAMENTE anteriores
  // deben estar jugadas y sin asistencia — recién ahí cuenta que esta fecha
  // tenga una asistencia como "asistencia después de una sequía". Si el
  // jugador faltó a alguna de esas fechas, no se puede demostrar la sequía
  // (no jugó, no es que "no asistió"), así que la misión no se completa.
  [MISSION_TYPES.ASSIST_AFTER_DROUGHT]: (facts, idx, p) => {
    const n = p.droughtMatches || 3;
    if (facts[idx].assists < 1) return false;
    if (idx < n) return false;
    for (let i = idx - n; i < idx; i++) {
      if (!facts[i].played || facts[i].assists > 0) return false;
    }
    return true;
  },
  [MISSION_TYPES.FIRST_AWARD]: (facts, idx) => {
    const priorAwards = facts.slice(0, idx).reduce((s, f) => s + (f.played ? f.awardsCount : 0), 0);
    return priorAwards === 0 && facts[idx].awardsCount >= 1;
  },
  [MISSION_TYPES.VOTE_COUNT]: (facts, idx, p) => facts[idx].votes >= (p.n || 1),
  [MISSION_TYPES.DOUBLE_AWARD]: (facts, idx) => facts[idx].awardsCount >= 2,
  [MISSION_TYPES.PRESENCE_STREAK]: (facts, idx, p) => streakEndingAt(facts, idx, () => true) >= (p.n || 3),
  [MISSION_TYPES.RETURN_CONTRIBUTION]: (facts, idx) => {
    if (idx === 0) return false; // no hay fecha anterior del plantel: no se puede demostrar una ausencia
    const wasAbsentBefore = !facts[idx - 1].played;
    return wasAbsentBefore && facts[idx].goals + facts[idx].assists >= 1;
  },
  [MISSION_TYPES.TEAM_WIN]: (facts, idx) => facts[idx].win,
  [MISSION_TYPES.WIN_STREAK]: (facts, idx, p) => streakEndingAt(facts, idx, (f) => f.win) >= (p.n || 2),
  [MISSION_TYPES.CLEAN_SHEET]: (facts, idx) => facts[idx].cleanSheet,
  [MISSION_TYPES.CLEAN_SHEET_STREAK]: (facts, idx, p) => streakEndingAt(facts, idx, (f) => f.cleanSheet) >= (p.n || 2),
  [MISSION_TYPES.GOAL_AND_WIN]: (facts, idx) => facts[idx].goals >= 1 && facts[idx].win,
  [MISSION_TYPES.ASSIST_AND_WIN]: (facts, idx) => facts[idx].assists >= 1 && facts[idx].win,
  // Gana el partido sin sumar goles ni asistencias personales. Es un hecho
  // 100% demostrable (goles=0, asistencias=0, ganó) — no se le atribuye al
  // jugador ninguna acción defensiva que la app no registre.
  [MISSION_TYPES.WIN_WITHOUT_PERSONAL_STATS]: (facts, idx) => facts[idx].win && facts[idx].goals === 0 && facts[idx].assists === 0,
  // Variante más exigente para ARQ/DEF: además, valla invicta en esa fecha.
  [MISSION_TYPES.CLEAN_SHEET_WIN_WITHOUT_STATS]: (facts, idx) =>
    facts[idx].win && facts[idx].cleanSheet && facts[idx].goals === 0 && facts[idx].assists === 0,
  [MISSION_TYPES.AWARD_AND_PARTICIPATION]: (facts, idx) => facts[idx].awardsCount >= 1 && facts[idx].goals + facts[idx].assists >= 1,
  [MISSION_TYPES.PERFECT_MATCH]: (facts, idx) => facts[idx].goals >= 1 && facts[idx].assists >= 1 && facts[idx].win,
};

// Tipos que necesitan historial previo para ser evaluables (evita "misiones
// imposibles" para un jugador nuevo): declaran cuántas fechas previas del
// PLANTEL (jugadas o no) hacen falta como mínimo antes de poder elegirse.
const MIN_PRIOR_MATCHES = {
  [MISSION_TYPES.SCORE_STREAK]: (p) => (p.n || 2) - 1,
  [MISSION_TYPES.ASSIST_STREAK]: (p) => (p.n || 2) - 1,
  [MISSION_TYPES.WIN_STREAK]: (p) => (p.n || 2) - 1,
  [MISSION_TYPES.CLEAN_SHEET_STREAK]: (p) => (p.n || 2) - 1,
  [MISSION_TYPES.PRESENCE_STREAK]: (p) => (p.n || 3) - 1,
  [MISSION_TYPES.ASSIST_AFTER_DROUGHT]: (p) => p.droughtMatches || 3,
  [MISSION_TYPES.RETURN_CONTRIBUTION]: () => 1,
};

// Devuelve cuántas fechas previas hacen falta para que la misión sea, como
// mínimo, matemáticamente posible de comprobar (no de cumplir).
export function minPriorMatchesFor(mission) {
  const fn = MIN_PRIOR_MATCHES[mission.type];
  return fn ? fn(mission.params || {}) : 0;
}

// ---------- Catálogo (50 misiones) ----------
// difficulty: uso INTERNO únicamente (para elegir con qué frecuencia sale cada
// una según el historial del jugador) — nunca se muestra en la interfaz como
// una mecánica de videojuego. eligiblePositions: null (todas) o una lista de
// grupos ARQ/DEF/MED/DEL (ver sportsConfig.posGroupOf).
export const SECRET_MISSIONS = [
  { id: "sm01", name: "Una y una", description: "Marcar y asistir en el mismo partido.", type: MISSION_TYPES.GOAL_AND_ASSIST, params: {}, difficulty: "media", eligiblePositions: null, repeatable: true, revealText: "Marcó y asistió en la misma fecha." },
  { id: "sm02", name: "Doblete de área", description: "Marcar 2 goles en el partido jugando de delantero.", type: MISSION_TYPES.MULTI_GOAL, params: { n: 2 }, difficulty: "media", eligiblePositions: ["DEL"], repeatable: true, revealText: "Convirtió 2 goles en la fecha." },
  { id: "sm03", name: "Doblete de mediocampo", description: "Marcar 2 goles en el partido jugando de mediocampista.", type: MISSION_TYPES.MULTI_GOAL, params: { n: 2 }, difficulty: "dificil", eligiblePositions: ["MED"], repeatable: true, revealText: "Convirtió 2 goles jugando de mediocampista." },
  { id: "sm04", name: "Hat-trick de potrero", description: "Marcar 3 goles en el partido.", type: MISSION_TYPES.MULTI_GOAL, params: { n: 3 }, difficulty: "dificil", eligiblePositions: ["DEL"], repeatable: true, revealText: "Convirtió 3 goles en la fecha." },
  { id: "sm05", name: "Repartidor", description: "Dar 2 asistencias en el partido.", type: MISSION_TYPES.MULTI_ASSIST, params: { n: 2 }, difficulty: "media", eligiblePositions: null, repeatable: true, revealText: "Dio 2 asistencias en la fecha." },
  { id: "sm06", name: "Doble entrega", description: "Dar 2 asistencias en el partido jugando de defensor.", type: MISSION_TYPES.MULTI_ASSIST, params: { n: 2 }, difficulty: "dificil", eligiblePositions: ["DEF"], repeatable: true, revealText: "Dio 2 asistencias jugando de defensor." },
  { id: "sm07", name: "Metió los dos", description: "Sumar 2 participaciones de gol (goles + asistencias) en el partido.", type: MISSION_TYPES.GOAL_PARTICIPATION_TOTAL, params: { n: 2 }, difficulty: "facil", eligiblePositions: null, repeatable: true, revealText: "Sumó 2 participaciones de gol en la fecha." },
  { id: "sm08", name: "Fecha de gala", description: "Sumar 3 participaciones de gol (goles + asistencias) en el partido.", type: MISSION_TYPES.GOAL_PARTICIPATION_TOTAL, params: { n: 3 }, difficulty: "dificil", eligiblePositions: null, repeatable: true, revealText: "Sumó 3 participaciones de gol en la fecha." },
  { id: "sm09", name: "Sigue derecho", description: "Convertir en 2 fechas oficiales consecutivas.", type: MISSION_TYPES.SCORE_STREAK, params: { n: 2 }, difficulty: "media", eligiblePositions: null, repeatable: true, revealText: "Convirtió en 2 fechas consecutivas." },
  { id: "sm10", name: "No para de gritarlo", description: "Convertir en 3 fechas oficiales consecutivas.", type: MISSION_TYPES.SCORE_STREAK, params: { n: 3 }, difficulty: "dificil", eligiblePositions: null, repeatable: true, revealText: "Convirtió en 3 fechas consecutivas." },
  { id: "sm11", name: "Racha asistidora", description: "Dar asistencia en 2 fechas oficiales consecutivas.", type: MISSION_TYPES.ASSIST_STREAK, params: { n: 2 }, difficulty: "media", eligiblePositions: null, repeatable: true, revealText: "Asistió en 2 fechas consecutivas." },
  { id: "sm12", name: "Racha asistidora larga", description: "Dar asistencia en 3 fechas oficiales consecutivas.", type: MISSION_TYPES.ASSIST_STREAK, params: { n: 3 }, difficulty: "dificil", eligiblePositions: null, repeatable: true, revealText: "Asistió en 3 fechas consecutivas." },
  { id: "sm13", name: "Segunda chance", description: "Dar una asistencia después de 3 fechas jugadas sin asistir.", type: MISSION_TYPES.ASSIST_AFTER_DROUGHT, params: { droughtMatches: 3 }, difficulty: "media", eligiblePositions: null, repeatable: true, revealText: "Volvió a asistir después de 3 fechas sin hacerlo." },
  { id: "sm14", name: "Se hizo notar", description: "Recibir su primer reconocimiento del grupo.", type: MISSION_TYPES.FIRST_AWARD, params: {}, difficulty: "facil", eligiblePositions: null, repeatable: false, revealText: "Recibió su primer reconocimiento del grupo." },
  { id: "sm15", name: "Che, pibe", description: "Recibir su primer reconocimiento del grupo jugando de arquero.", type: MISSION_TYPES.FIRST_AWARD, params: {}, difficulty: "facil", eligiblePositions: ["ARQ"], repeatable: false, revealText: "El arquero recibió su primer reconocimiento." },
  { id: "sm16", name: "Voto de confianza", description: "Recibir al menos 1 voto a figura del partido.", type: MISSION_TYPES.VOTE_COUNT, params: { n: 1 }, difficulty: "facil", eligiblePositions: null, repeatable: true, revealText: "Recibió al menos 1 voto a figura." },
  { id: "sm17", name: "Doble voto", description: "Recibir al menos 2 votos a figura del partido.", type: MISSION_TYPES.VOTE_COUNT, params: { n: 2 }, difficulty: "media", eligiblePositions: null, repeatable: true, revealText: "Recibió al menos 2 votos a figura." },
  { id: "sm18", name: "Mayoría propia", description: "Recibir al menos 3 votos a figura del partido.", type: MISSION_TYPES.VOTE_COUNT, params: { n: 3 }, difficulty: "dificil", eligiblePositions: null, repeatable: true, revealText: "Recibió al menos 3 votos a figura." },
  { id: "sm19", name: "Doble mérito", description: "Recibir 2 reconocimientos en la misma fecha.", type: MISSION_TYPES.DOUBLE_AWARD, params: {}, difficulty: "dificil", eligiblePositions: null, repeatable: true, revealText: "Recibió 2 reconocimientos en la misma fecha." },
  { id: "sm20", name: "Racha corta y efectiva", description: "Completar una racha de 2 presencias consecutivas.", type: MISSION_TYPES.PRESENCE_STREAK, params: { n: 2 }, difficulty: "facil", eligiblePositions: null, repeatable: true, revealText: "2 fechas consecutivas jugadas." },
  { id: "sm21", name: "No afloja", description: "Completar una racha de 3 presencias consecutivas.", type: MISSION_TYPES.PRESENCE_STREAK, params: { n: 3 }, difficulty: "facil", eligiblePositions: null, repeatable: true, revealText: "3 fechas consecutivas jugadas." },
  { id: "sm22", name: "Constante", description: "Completar una racha de 4 presencias consecutivas.", type: MISSION_TYPES.PRESENCE_STREAK, params: { n: 4 }, difficulty: "facil", eligiblePositions: null, repeatable: true, revealText: "4 fechas consecutivas jugadas." },
  { id: "sm23", name: "Ni loco se lo pierde", description: "Completar una racha de 5 presencias consecutivas.", type: MISSION_TYPES.PRESENCE_STREAK, params: { n: 5 }, difficulty: "media", eligiblePositions: null, repeatable: true, revealText: "5 fechas consecutivas jugadas." },
  { id: "sm24", name: "Pieza fija", description: "Completar una racha de 6 presencias consecutivas.", type: MISSION_TYPES.PRESENCE_STREAK, params: { n: 6 }, difficulty: "media", eligiblePositions: null, repeatable: true, revealText: "6 fechas consecutivas jugadas." },
  { id: "sm25", name: "Presente siempre", description: "Completar una racha de 8 presencias consecutivas.", type: MISSION_TYPES.PRESENCE_STREAK, params: { n: 8 }, difficulty: "dificil", eligiblePositions: null, repeatable: true, revealText: "8 fechas consecutivas jugadas." },
  { id: "sm26", name: "El que no se lo pierde", description: "Completar una racha de 10 presencias consecutivas.", type: MISSION_TYPES.PRESENCE_STREAK, params: { n: 10 }, difficulty: "dificil", eligiblePositions: null, repeatable: true, revealText: "10 fechas consecutivas jugadas." },
  { id: "sm27", name: "Volvió con todo", description: "Aportar un gol o asistencia en la fecha inmediatamente después de una ausencia.", type: MISSION_TYPES.RETURN_CONTRIBUTION, params: {}, difficulty: "media", eligiblePositions: null, repeatable: true, revealText: "Volvió de una ausencia y participó de un gol." },
  { id: "sm28", name: "Volvió y la metió", description: "Aportar un gol o asistencia en la fecha inmediatamente después de una ausencia, jugando de delantero.", type: MISSION_TYPES.RETURN_CONTRIBUTION, params: {}, difficulty: "media", eligiblePositions: ["DEL"], repeatable: true, revealText: "El delantero volvió de una ausencia y participó de un gol." },
  { id: "sm29", name: "Ganador nato", description: "Ganar el partido.", type: MISSION_TYPES.TEAM_WIN, params: {}, difficulty: "facil", eligiblePositions: null, repeatable: true, revealText: "Ganó la fecha con su equipo." },
  { id: "sm30", name: "Racha ganadora", description: "Ganar 2 fechas oficiales consecutivas.", type: MISSION_TYPES.WIN_STREAK, params: { n: 2 }, difficulty: "media", eligiblePositions: null, repeatable: true, revealText: "Ganó 2 fechas consecutivas." },
  { id: "sm31", name: "Invicto", description: "Ganar 3 fechas oficiales consecutivas.", type: MISSION_TYPES.WIN_STREAK, params: { n: 3 }, difficulty: "dificil", eligiblePositions: null, repeatable: true, revealText: "Ganó 3 fechas consecutivas." },
  { id: "sm32", name: "Racha ganadora larga", description: "Ganar 4 fechas oficiales consecutivas.", type: MISSION_TYPES.WIN_STREAK, params: { n: 4 }, difficulty: "dificil", eligiblePositions: null, repeatable: true, revealText: "Ganó 4 fechas consecutivas." },
  { id: "sm33", name: "Arco en cero", description: "Terminar el partido con la valla invicta, jugando de arquero.", type: MISSION_TYPES.CLEAN_SHEET, params: {}, difficulty: "media", eligiblePositions: ["ARQ"], repeatable: true, revealText: "Terminó la fecha con la valla invicta." },
  { id: "sm34", name: "Muralla", description: "Terminar el partido con la valla invicta, jugando de defensor.", type: MISSION_TYPES.CLEAN_SHEET, params: {}, difficulty: "media", eligiblePositions: ["DEF"], repeatable: true, revealText: "Terminó la fecha con la valla invicta." },
  { id: "sm35", name: "Arquero de fierro", description: "Terminar con la valla invicta en 2 fechas oficiales consecutivas, jugando de arquero.", type: MISSION_TYPES.CLEAN_SHEET_STREAK, params: { n: 2 }, difficulty: "dificil", eligiblePositions: ["ARQ"], repeatable: true, revealText: "2 fechas consecutivas con la valla invicta." },
  { id: "sm36", name: "Defensa de fierro", description: "Terminar con la valla invicta en 2 fechas oficiales consecutivas, jugando de defensor.", type: MISSION_TYPES.CLEAN_SHEET_STREAK, params: { n: 2 }, difficulty: "dificil", eligiblePositions: ["DEF"], repeatable: true, revealText: "2 fechas consecutivas con la valla invicta." },
  { id: "sm37", name: "Voto de confianza (arquero)", description: "Recibir al menos 1 voto a figura del partido, jugando de arquero.", type: MISSION_TYPES.VOTE_COUNT, params: { n: 1 }, difficulty: "facil", eligiblePositions: ["ARQ"], repeatable: true, revealText: "El arquero recibió al menos 1 voto a figura." },
  { id: "sm38", name: "Gol que vale doble", description: "Convertir en un partido que terminó ganando.", type: MISSION_TYPES.GOAL_AND_WIN, params: {}, difficulty: "facil", eligiblePositions: null, repeatable: true, revealText: "Convirtió en un partido ganado." },
  { id: "sm39", name: "Gol de local", description: "Convertir en un partido ganado, jugando de delantero.", type: MISSION_TYPES.GOAL_AND_WIN, params: {}, difficulty: "facil", eligiblePositions: ["DEL"], repeatable: true, revealText: "El delantero convirtió en un partido ganado." },
  { id: "sm40", name: "Asistencia que vale oro", description: "Dar una asistencia en un partido que terminó ganando.", type: MISSION_TYPES.ASSIST_AND_WIN, params: {}, difficulty: "facil", eligiblePositions: null, repeatable: true, revealText: "Asistió en un partido ganado." },
  { id: "sm41", name: "Pase de gol clave", description: "Dar una asistencia en un partido ganado, jugando de mediocampista.", type: MISSION_TYPES.ASSIST_AND_WIN, params: {}, difficulty: "facil", eligiblePositions: ["MED"], repeatable: true, revealText: "El mediocampista asistió en un partido ganado." },
  { id: "sm42", name: "Ganó sin figurar", description: "Ganar el partido sin sumar goles ni asistencias.", type: MISSION_TYPES.WIN_WITHOUT_PERSONAL_STATS, params: {}, difficulty: "media", eligiblePositions: null, repeatable: true, revealText: "Ganó el partido sin sumar goles ni asistencias." },
  { id: "sm43", name: "Ganó y tapó todo", description: "Ganar el partido con la valla invicta, sin sumar goles ni asistencias, jugando de arquero.", type: MISSION_TYPES.CLEAN_SHEET_WIN_WITHOUT_STATS, params: {}, difficulty: "media", eligiblePositions: ["ARQ"], repeatable: true, revealText: "Ganó con la valla invicta, sin figurar en goles ni asistencias." },
  { id: "sm44", name: "Ganó desde atrás", description: "Ganar el partido con la valla invicta, sin sumar goles ni asistencias, jugando de defensor.", type: MISSION_TYPES.CLEAN_SHEET_WIN_WITHOUT_STATS, params: {}, difficulty: "media", eligiblePositions: ["DEF"], repeatable: true, revealText: "Ganó con la valla invicta, sin figurar en goles ni asistencias." },
  { id: "sm45", name: "Partido redondo", description: "Marcar, asistir y ganar en la misma fecha.", type: MISSION_TYPES.PERFECT_MATCH, params: {}, difficulty: "dificil", eligiblePositions: null, repeatable: true, revealText: "Marcó, asistió y ganó en la misma fecha." },
  { id: "sm46", name: "Redondísima", description: "Marcar, asistir y ganar en la misma fecha, jugando de mediocampista.", type: MISSION_TYPES.PERFECT_MATCH, params: {}, difficulty: "dificil", eligiblePositions: ["MED"], repeatable: true, revealText: "El mediocampista marcó, asistió y ganó en la misma fecha." },
  { id: "sm47", name: "Fecha especial", description: "Sumar una participación de gol y un reconocimiento en la misma fecha.", type: MISSION_TYPES.AWARD_AND_PARTICIPATION, params: {}, difficulty: "media", eligiblePositions: null, repeatable: true, revealText: "Participó de un gol y recibió un reconocimiento en la misma fecha." },
  { id: "sm48", name: "Fecha completa", description: "Sumar una participación de gol y un reconocimiento en la misma fecha, jugando de defensor.", type: MISSION_TYPES.AWARD_AND_PARTICIPATION, params: {}, difficulty: "dificil", eligiblePositions: ["DEF"], repeatable: true, revealText: "El defensor participó de un gol y recibió un reconocimiento." },
  { id: "sm49", name: "Fecha de reconocidos", description: "Sumar una participación de gol y un reconocimiento en la misma fecha, jugando de arquero.", type: MISSION_TYPES.AWARD_AND_PARTICIPATION, params: {}, difficulty: "dificil", eligiblePositions: ["ARQ"], repeatable: true, revealText: "El arquero participó de un gol y recibió un reconocimiento." },
  { id: "sm50", name: "Doble asistencia clave", description: "Dar 2 asistencias en un partido que terminó ganando.", type: MISSION_TYPES.MULTI_ASSIST, params: { n: 2 }, difficulty: "media", eligiblePositions: null, repeatable: true, revealText: "Dio 2 asistencias en un partido ganado." },
];

// Chequea, a nivel de catálogo, que cada misión tenga un tipo válido con
// checker registrado. Se usa en la auditoría/pruebas — no en runtime.
export function isMissionWellFormed(mission) {
  return typeof CHECKERS[mission.type] === "function" && typeof mission.id === "string" && typeof mission.name === "string";
}
