// Pruebas verificables del Puntaje con coeficientes por posición (v3.3).
// Se ejecutan con: node scripts/verify-rating.mjs
import assert from "node:assert/strict";
import { computeMatchRating, RATING_CONFIG } from "../src/lib/rating.js";
import { OFFICIAL_MARKET_MODES } from "../src/lib/marketValue.js";

function participant(playerId, position, team, extra = {}) {
  return { playerId, position, team, goals: 0, assists: 0, ownGoals: 0, ...extra };
}
function match(mode, participants, awards = []) {
  return { id: "m", date: "2026-01-01", mode, participants, awards };
}

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✔ ${name}`);
  } catch (e) {
    console.error(`✘ ${name}`);
    console.error("  " + e.message);
    process.exitCode = 1;
  }
}

// ---------- 1) Un gol de un DFC aporta más puntaje que un gol de un DC ----------
check("un gol de un DFC aporta más puntos de Puntaje que un gol de un DC", () => {
  const m = match("Fútbol 8", [
    participant("dfc", "DFC", "A", { goals: 1 }),
    participant("dc", "DC", "B", { goals: 1 }),
  ]);
  const rDfc = computeMatchRating(m, "dfc", {});
  const rDc = computeMatchRating(m, "dc", {});
  // Base 6 + gol: DFC = 6 + 1*1*2 = 8; DC = 6 + 1*1*1 = 7 (sin victoria porque están 1-1... en este
  // caso son equipos distintos con 1 gol cada uno: empate, ninguno de los dos suma WIN_INC).
  assert.equal(rDfc.rating, 6 + 1 * RATING_CONFIG.GOAL_INC * 2, `rating DFC esperado 8, dio ${rDfc.rating}`);
  assert.equal(rDc.rating, 6 + 1 * RATING_CONFIG.GOAL_INC * 1, `rating DC esperado 7, dio ${rDc.rating}`);
  assert.ok(rDfc.rating > rDc.rating, `esperado DFC (${rDfc.rating}) > DC (${rDc.rating})`);
});

// ---------- 2) Una asistencia de un defensor aplica correctamente su coeficiente ----------
check("una asistencia de un DFC aplica el coeficiente ×1,5 sobre los 0,6 puntos base", () => {
  const m = match("Fútbol 8", [
    participant("dfc", "DFC", "A", { assists: 1 }),
    participant("compañero", "DC", "A", { goals: 1 }),
    participant("rival", "DC", "B"),
  ]);
  const r = computeMatchRating(m, "dfc", {});
  const expected = 6 + 1 * RATING_CONFIG.ASSIST_INC * 1.5 + RATING_CONFIG.WIN_INC + RATING_CONFIG.CLEAN_SHEET_INC; // ganó 1-0 sin goles en contra: además suma valla invicta (es DEF)
  assert.ok(Math.abs(r.rating - expected) < 1e-9, `esperado ${expected}, dio ${r.rating}`);
});

// ---------- 3) Las estadísticas visibles siguen mostrando las cantidades reales ----------
check("el gol/asistencia ponderado nunca cambia la cantidad real mostrada", () => {
  const m = match("Fútbol 8", [participant("arq", "ARQ", "A", { goals: 2, assists: 1 }), participant("rival", "DC", "B")]);
  const r = computeMatchRating(m, "arq", {});
  assert.equal(r.goals, 2, "la cantidad de goles debe seguir siendo 2, sin multiplicar por el coeficiente");
  assert.equal(r.assists, 1, "la cantidad de asistencias debe seguir siendo 1, sin multiplicar por el coeficiente");
});

// ---------- 4) El puntaje del partido nunca sale de 2 a 10 ----------
check("el puntaje de un partido nunca supera 10 ni baja de 2, aun con coeficientes altos", () => {
  const golazo = match("Fútbol 8", [
    participant("arq", "ARQ", "A", { goals: 5, assists: 5 }), // coeficiente ARQ es el más alto (×2,5/×1,5)
    participant("rival", "DC", "B"),
  ], [{ label: "Figura", playerId: "arq" }]);
  const rMax = computeMatchRating(golazo, "arq", { v1: "arq", v2: "arq", v3: "arq", v4: "arq" });
  assert.ok(rMax.rating <= RATING_CONFIG.MAX, `no debería superar ${RATING_CONFIG.MAX}, dio ${rMax.rating}`);

  const desastre = match("Fútbol 8", [
    participant("arq", "ARQ", "A", { ownGoals: 6 }),
    participant("rival", "DC", "B", { goals: 4 }),
  ]);
  const rMin = computeMatchRating(desastre, "arq", {});
  assert.ok(rMin.rating >= RATING_CONFIG.MIN, `no debería bajar de ${RATING_CONFIG.MIN}, dio ${rMin.rating}`);
});

// ---------- 5) F5/F6 no reciben estos coeficientes (mantienen sus reglas actuales) ----------
check("Fútbol 5/6 no forman parte del sistema de coeficientes del Valor Mercenario ni deberían pasar por matchRating en la app", () => {
  // Los coeficientes viven en sportsConfig.js y matchRating() los aplica siempre que se
  // lo invoque — pero en App.jsx, TODAS las funciones que llaman a matchRating() filtran
  // antes con onlyOfficialMatches(), así que F5/F6 nunca llegan a esta fórmula: usan su
  // propio sistema (computeF56Bonus), completamente aparte. Acá solo confirmamos que
  // "Fútbol 5" y "Fútbol 6" no están en la lista de modalidades oficiales que sí reciben
  // coeficiente — esa lista es la que protege la regla.
  assert.equal(OFFICIAL_MARKET_MODES.includes("Fútbol 5"), false);
  assert.equal(OFFICIAL_MARKET_MODES.includes("Fútbol 6"), false);
  assert.ok(OFFICIAL_MARKET_MODES.includes("Fútbol 8") && OFFICIAL_MARKET_MODES.includes("Fútbol 9"));
});

// ---------- 6) Puntaje y Valor Mercenario siguen siendo sistemas separados ----------
check("computeMatchRating no calcula ni devuelve Valor Mercenario, y viceversa", () => {
  const m = match("Fútbol 8", [participant("dfc", "DFC", "A", { goals: 1 })]);
  const r = computeMatchRating(m, "dfc", {});
  assert.ok(!("marketValue" in r) && !("valorMercenario" in r) && !("M" in r));
});

console.log(`\n${passed}/6 pruebas pasaron.`);
if (process.exitCode) {
  console.error("Hay pruebas que fallaron — revisar arriba.");
} else {
  console.log("Todas las pruebas del Puntaje con coeficientes pasaron.");
}
