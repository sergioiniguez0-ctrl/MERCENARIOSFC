// Tabla de calibración (v3.3) — jugadores FICTICIOS, ninguno real.
// Corre una temporada de 20 fechas oficiales simuladas (Fútbol 8) para un plantel
// de 10 jugadores de distintas posiciones, y muestra el Puntaje y el Valor
// Mercenario resultantes de cada uno, para demostrar que un defensor destacado
// puede quedar a la par de un delantero destacado — sin regalarle nada por el
// solo hecho de jugar de defensor (por eso se incluye un defensor discreto y un
// delantero discreto como contraste).
// Se ejecuta con: node scripts/calibration-table.mjs
import { computeMatchRating } from "../src/lib/rating.js";
import { computeMarketValue, formatMarketValue } from "../src/lib/marketValue.js";

const N = 20;

// Reparte `total` lo más parejo posible en N fechas (suma exacta = total).
function spread(total, n) {
  const base = Math.floor(total / n);
  const rest = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < rest ? 1 : 0));
}

const roster = [
  // ---- Equipo A: el "equipo fuerte" ----
  { id: "arq_fiable", name: "Arquero Fiable", position: "ARQ", team: "A", goals: 0, assists: 1, awardIdx: [2, 9, 16], awardLabel: "Arquero de la fecha" },
  { id: "defensor_roca", name: "Defensor Roca", position: "DFC", team: "A", goals: 3, assists: 4, awardIdx: [1, 6, 11, 16], awardLabel: "Defensor de la fecha" },
  { id: "volante_motor", name: "Volante Motor", position: "VOD", team: "A", goals: 6, assists: 7, awardIdx: [5], awardLabel: "Mejor pase" },
  { id: "extremo_encarador", name: "Extremo Encarador", position: "EXT", team: "A", goals: 9, assists: 4, awardIdx: [8], awardLabel: "El distinto" },
  { id: "killer_9", name: "Killer 9", position: "DC", team: "A", goals: 16, assists: 5, awardIdx: [0, 4, 9, 13, 18], awardLabel: "Figura" },
  // ---- Equipo B: el "equipo débil", con un defensor y un delantero discretos de contraste ----
  { id: "arquero_b", name: "Arquero B", position: "ARQ", team: "B", goals: 0, assists: 0, awardIdx: [], awardLabel: null },
  { id: "defensor_discreto", name: "Defensor Discreto", position: "DFC", team: "B", goals: 1, assists: 1, awardIdx: [], awardLabel: null },
  { id: "lateral_rayo", name: "Lateral Rayo", position: "LAT", team: "B", goals: 4, assists: 5, awardIdx: [12], awardLabel: "Mejor gambeta" },
  { id: "enganche_clase", name: "Enganche Clase", position: "VOF", team: "B", goals: 7, assists: 6, awardIdx: [3, 15], awardLabel: "Mejor pase" },
  { id: "delantero_mediocre", name: "Delantero Mediocre", position: "DC", team: "B", goals: 2, assists: 1, awardIdx: [], awardLabel: null },
];

const players = roster.map((r) => ({ id: r.id, name: r.name, position: r.position }));

// Reparte los goles/asistencias de cada jugador en las 20 fechas.
const perMatch = {};
roster.forEach((r) => {
  perMatch[r.id] = { goals: spread(r.goals, N), assists: spread(r.assists, N) };
});

const matches = Array.from({ length: N }, (_, i) => {
  const date = `2026-01-${String(i + 1).padStart(2, "0")}`;
  const participants = roster.map((r) => ({
    playerId: r.id,
    position: r.position,
    team: r.team,
    goals: perMatch[r.id].goals[i],
    assists: perMatch[r.id].assists[i],
    ownGoals: 0,
  }));
  const awards = roster.filter((r) => r.awardIdx.includes(i)).map((r) => ({ label: r.awardLabel, playerId: r.id }));
  return { id: `f${i + 1}`, date, mode: "Fútbol 8", participants, awards };
});

console.log(`Simulación: ${N} fechas oficiales (Fútbol 8), ${roster.length} jugadores ficticios.\n`);

const rows = roster.map((r) => {
  const ratings = matches.map((m) => computeMatchRating(m, r.id, {}).rating);
  const puntaje = ratings.reduce((s, v) => s + v, 0) / ratings.length;
  const mv = computeMarketValue({ id: r.id }, players, matches, {});
  const totalGoals = perMatch[r.id].goals.reduce((s, v) => s + v, 0);
  const totalAssists = perMatch[r.id].assists.reduce((s, v) => s + v, 0);
  return {
    Jugador: r.name,
    Posición: r.position,
    Partidos: N,
    Goles: totalGoals,
    Asistencias: totalAssists,
    Reconocimientos: r.awardIdx.length,
    "Puntaje resultante": puntaje.toFixed(2),
    "Valor Mercenario resultante": formatMarketValue(mv.current),
  };
});

console.table(rows);

const roca = rows.find((r) => r.Jugador === "Defensor Roca");
const killer = rows.find((r) => r.Jugador === "Killer 9");
const discreto = rows.find((r) => r.Jugador === "Defensor Discreto");
const mediocre = rows.find((r) => r.Jugador === "Delantero Mediocre");

console.log("\nLectura de la simulación:");
console.log(
  `- Defensor Roca (DFC destacado, ${roca.Goles} goles) queda con Puntaje ${roca["Puntaje resultante"]} y Valor ${roca["Valor Mercenario resultante"]}, ` +
    `comparable a Killer 9 (DC destacado, ${killer.Goles} goles): Puntaje ${killer["Puntaje resultante"]} y Valor ${killer["Valor Mercenario resultante"]}.`
);
console.log(
  `- Defensor Discreto (mismo equipo y misma posición que Roca, pero sin su rendimiento) se queda en Puntaje ${discreto["Puntaje resultante"]} ` +
    `y Valor ${discreto["Valor Mercenario resultante"]}: jugar de defensor NO alcanza por sí solo para una cotización alta.`
);
console.log(
  `- Delantero Mediocre, de contraste en la misma posición que Killer 9, se queda en Puntaje ${mediocre["Puntaje resultante"]} ` +
    `y Valor ${mediocre["Valor Mercenario resultante"]}: tampoco alcanza con jugar de 9, hay que rendir.`
);
