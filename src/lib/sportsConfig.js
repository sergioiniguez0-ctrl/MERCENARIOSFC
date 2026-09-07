// ---------- Configuración deportiva compartida (v3.3) ----------
// Fuente ÚNICA de los coeficientes por posición: los usan tanto el Puntaje
// (App.jsx -> matchRating, solo en partidos oficiales F8/F9) como el Valor
// Mercenario (marketValue.js). Cambiar un número acá lo cambia automáticamente
// en los dos sistemas — ya no puede haber valores duplicados o distintos entre
// uno y otro, tal como se pidió.
//
// Los coeficientes solo ponderan los PUNTOS que aportan un gol o una asistencia
// en cada fórmula. Nunca tocan la estadística real: un gol siempre se sigue
// contando, mostrando y guardando como un gol; una asistencia, como una
// asistencia.
export const POSITION_COEFFICIENTS = {
  ARQ: { goal: 2.5, assist: 1.5 },
  DFC: { goal: 2, assist: 1.5 },
  LAT: { goal: 1.7, assist: 1.4 },
  VOD: { goal: 1.5, assist: 1.25 },
  VOF: { goal: 1.2, assist: 1 },
  EXT: { goal: 1.1, assist: 1 },
  DC: { goal: 1, assist: 1.1 },
};

// Si un jugador todavía tiene guardada una posición GENÉRICA (DEF/MED/DEL — dato
// viejo o simplemente no afinado todavía por el administrador), NO se asume que
// sea una posición específica en particular ("DEF" no es necesariamente "DFC").
// Para poder calcular igual, se usa el promedio de los coeficientes de las
// posiciones específicas que componen ese grupo.
const GENERIC_GROUP_MEMBERS = { DEF: ["DFC", "LAT"], MED: ["VOD", "VOF"], DEL: ["DC", "EXT"], ARQ: ["ARQ"] };
function averageCoefficients(positionIds) {
  const goal = positionIds.reduce((s, id) => s + POSITION_COEFFICIENTS[id].goal, 0) / positionIds.length;
  const assist = positionIds.reduce((s, id) => s + POSITION_COEFFICIENTS[id].assist, 0) / positionIds.length;
  return { goal, assist };
}

// Devuelve { goal, assist } para cualquier valor de posición guardado, específico
// o genérico. Es la única función que ambos sistemas deben usar para obtener el
// coeficiente de un jugador — así se evita que cada uno resuelva el caso
// "posición genérica" de una forma distinta.
export function coefficientsFor(positionId) {
  if (POSITION_COEFFICIENTS[positionId]) return POSITION_COEFFICIENTS[positionId];
  const members = GENERIC_GROUP_MEMBERS[positionId];
  if (members) return averageCoefficients(members);
  return { goal: 1, assist: 1 }; // resguardo final para un dato inesperado
}

// Grupo grueso (ARQ/DEF/MED/DEL), usado para valla invicta y para comparar
// "rendimiento relativo a la posición" en el Valor Mercenario.
export function posGroupOf(positionId) {
  if (["DFC", "LAT"].includes(positionId)) return "DEF";
  if (["VOD", "VOF"].includes(positionId)) return "MED";
  if (["DC", "EXT"].includes(positionId)) return "DEL";
  if (["ARQ", "DEF", "MED", "DEL"].includes(positionId)) return positionId;
  return positionId;
}

export function teamGoalsFor(match, team) {
  const own = match.participants.filter((x) => x.team === team).reduce((s, x) => s + (Number(x.goals) || 0), 0);
  const rivalOwnGoals = match.participants
    .filter((x) => x.team !== team)
    .reduce((s, x) => s + (Number(x.ownGoals) || 0), 0);
  return own + rivalOwnGoals;
}

// Modalidades oficiales (F8/F9): las únicas que generan estadísticas oficiales
// (goles, asistencias, reconocimientos, Valor Mercenario, Caminos de Potrero
// basados en esas estadísticas). F5/F6 solo cuentan presencia (ver commitment.js).
export const OFFICIAL_MODES = ["Fútbol 8", "Fútbol 9"];
export function isOfficialMode(mode) {
  return OFFICIAL_MODES.includes(mode);
}
export function onlyOfficialMatches(matches) {
  return (matches || []).filter((m) => isOfficialMode(m.mode));
}

export function posGroupLabel(group) {
  return { ARQ: "arqueros", DEF: "defensores", MED: "mediocampistas", DEL: "delanteros" }[group] || group;
}
