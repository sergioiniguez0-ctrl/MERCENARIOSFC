// Pruebas verificables del Valor Mercenario (v3.2).
// Se ejecutan con: node scripts/verify-market-value.mjs
// No dependen de ningún framework de testing (el entorno de build no tiene acceso
// a red para instalar uno) — son aserciones simples con `assert`, pensadas para
// poder leerse y correrse sin instalar nada.
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  computeMarketValue,
  MARKET_VALUE_CONFIG,
  OFFICIAL_MARKET_MODES,
} from "../src/lib/marketValue.js";

function participant(playerId, position, team, extra = {}) {
  return { playerId, position, team, goals: 0, assists: 0, ownGoals: 0, ...extra };
}

function officialMatch(id, date, participants, awards = []) {
  return { id, date, mode: "Fútbol 8", participants, awards };
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

// ---------- 1) Muchos partidos NO llevan automáticamente a 10 M ----------
check("un rendimiento modesto y sostenido no dispara la cotización a 10 M", () => {
  const players = [{ id: "modesto", position: "VOD" }, { id: "rival", position: "VOD" }];
  const matches = [];
  for (let i = 0; i < 40; i++) {
    const date = `2026-01-${String(i + 1).padStart(2, "0")}`;
    // Rendimiento discreto y parejo: gana la mitad de las veces, sin goles/asistencias.
    const win = i % 2 === 0;
    matches.push(
      officialMatch(`m${i}`, date, [
        participant("modesto", "VOD", win ? "A" : "B", { goals: 0, assists: 0 }),
        participant("rival", "VOD", win ? "B" : "A", { goals: 0, assists: 0 }),
      ])
    );
  }
  const mv = computeMarketValue(players[0], players, matches, {});
  assert.ok(mv.current < 7, `esperado < 7 M, dio ${mv.current}`);
  assert.ok(mv.maxHistoric <= MARKET_VALUE_CONFIG.MAX);
});

// ---------- 2) Un defensor destacado puede valer lo mismo que un delantero destacado ----------
check("un DFC destacado puede alcanzar una cotización similar a un DC destacado", () => {
  const players = [
    { id: "crack_dfc", position: "DFC" },
    { id: "peor_dfc", position: "DFC" },
    { id: "crack_dc", position: "DC" },
    { id: "peor_dc", position: "DC" },
  ];
  const matches = [];
  for (let i = 0; i < 20; i++) {
    const date = `2026-02-${String(i + 1).padStart(2, "0")}`;
    matches.push(
      officialMatch(`d${i}`, date, [
        // El defensor crack casi no convierte, pero su equipo casi no recibe goles (valla invicta constante).
        participant("crack_dfc", "DFC", "A", { goals: i % 6 === 0 ? 1 : 0, assists: i % 5 === 0 ? 1 : 0 }),
        participant("peor_dfc", "DFC", "B", { goals: 0, assists: 0 }),
        // El delantero crack convierte seguido.
        participant("crack_dc", "DC", "A", { goals: 2, assists: 1 }),
        participant("peor_dc", "DC", "B", { goals: 0, assists: 0 }),
      ], [{ label: "Defensor de la fecha", playerId: "crack_dfc" }])
    );
  }
  const mvDfc = computeMarketValue(players[0], players, matches, {});
  const mvDc = computeMarketValue(players[2], players, matches, {});
  assert.ok(mvDfc.current >= 8, `esperado DFC destacado >= 8 M, dio ${mvDfc.current}`);
  assert.ok(Math.abs(mvDfc.current - mvDc.current) <= 1.5, `diferencia demasiado grande: DFC ${mvDfc.current} vs DC ${mvDc.current}`);
});

// ---------- 3) Una ausencia no baja el valor ----------
check("faltar a una fecha no reduce la cotización", () => {
  const players = [{ id: "jugador", position: "EXT" }, { id: "otro", position: "EXT" }];
  const matches = [
    officialMatch("a1", "2026-03-01", [participant("jugador", "EXT", "A", { goals: 1 }), participant("otro", "EXT", "B")]),
    officialMatch("a2", "2026-03-08", [participant("jugador", "EXT", "A", { goals: 1 }), participant("otro", "EXT", "B")]),
    // "jugador" NO participa acá — solo juega "otro".
    officialMatch("a3", "2026-03-15", [participant("otro", "EXT", "B", { goals: 1 })]),
    officialMatch("a4", "2026-03-22", [participant("jugador", "EXT", "A", { goals: 1 }), participant("otro", "EXT", "B")]),
  ];
  const mv = computeMarketValue(players[0], players, matches, {});
  const valueBeforeAbsence = mv.history[1].value; // después de a2
  const valueAfterAbsence = mv.history[2].value; // después de a4 (su siguiente fecha jugada)
  assert.equal(mv.history.length, 3, "solo debe haber 3 entradas de historial (a3 no cuenta)");
  assert.ok(valueAfterAbsence >= valueBeforeAbsence, `el valor bajó tras la ausencia: ${valueBeforeAbsence} -> ${valueAfterAbsence}`);
});

// ---------- 4) F5/F6 no alteran la cotización ----------
check("los partidos de Fútbol 5/6 no modifican el Valor Mercenario", () => {
  const players = [{ id: "jugador", position: "DC" }, { id: "otro", position: "DC" }];
  const soloOficial = [officialMatch("o1", "2026-04-01", [participant("jugador", "DC", "A", { goals: 1 }), participant("otro", "DC", "B")])];
  const conAmistosos = [
    ...soloOficial,
    { id: "f5-1", date: "2026-04-02", mode: "Fútbol 5", participants: [participant("jugador", "DC", "A", { goals: 10, assists: 10 })], awards: [] },
    { id: "f5-2", date: "2026-04-03", mode: "Fútbol 6", participants: [participant("jugador", "DC", "A", { goals: 10, assists: 10 })], awards: [] },
  ];
  const mvSolo = computeMarketValue(players[0], players, soloOficial, {});
  const mvConAmistosos = computeMarketValue(players[0], players, conAmistosos, {});
  assert.equal(mvSolo.current, mvConAmistosos.current, "el valor no debería cambiar al agregar partidos F5/F6");
  assert.equal(OFFICIAL_MARKET_MODES.includes("Fútbol 5"), false);
  assert.equal(OFFICIAL_MARKET_MODES.includes("Fútbol 6"), false);
});

// ---------- 5) Ningún valor sale del rango 1–10 M ----------
check("ni una racha extraordinaria ni una pésima sacan el valor del rango 1-10 M", () => {
  const players = [
    { id: "figura", position: "DC" },
    { id: "desastre", position: "ARQ" },
    { id: "rival", position: "DC" },
  ];
  const matches = [];
  for (let i = 0; i < 60; i++) {
    const date = `2026-05-${String((i % 28) + 1).padStart(2, "0")}-${i}`;
    matches.push(
      officialMatch(`e${i}`, date, [
        participant("figura", "DC", "A", { goals: 5, assists: 3 }),
        participant("desastre", "ARQ", "B", { ownGoals: 3 }),
        participant("rival", "DC", "B", { goals: 0 }),
      ], [{ label: "Figura", playerId: "figura" }])
    );
  }
  const mvFigura = computeMarketValue(players[0], players, matches, {});
  const mvDesastre = computeMarketValue(players[1], players, matches, {});
  mvFigura.history.forEach((h) => assert.ok(h.value <= MARKET_VALUE_CONFIG.MAX && h.value >= MARKET_VALUE_CONFIG.MIN));
  mvDesastre.history.forEach((h) => assert.ok(h.value <= MARKET_VALUE_CONFIG.MAX && h.value >= MARKET_VALUE_CONFIG.MIN));
  assert.ok(mvFigura.current <= MARKET_VALUE_CONFIG.MAX);
  assert.ok(mvDesastre.current >= MARKET_VALUE_CONFIG.MIN);
});

// ---------- 6) Puntaje y Valor Mercenario siguen separados ----------
check("el módulo del Valor Mercenario no depende de ningún cálculo de Puntaje/rating", () => {
  const fs2 = fs;
  const src = fs2.readFileSync(new URL("../src/lib/marketValue.js", import.meta.url), "utf8");
  assert.ok(!/BASE_RATING|RATING_MIN|RATING_MAX/.test(src), "marketValue.js no debe referenciar constantes del Puntaje");
  // Y a la inversa: el objeto que devuelve computeMarketValue no incluye ningún campo de puntaje.
  const players = [{ id: "x", position: "DC" }];
  const mv = computeMarketValue(players[0], players, [], {});
  assert.ok(!("rating" in mv) && !("score" in mv) && !("puntaje" in mv));
});

console.log(`\n${passed}/6 pruebas pasaron.`);
if (process.exitCode) {
  console.error("Hay pruebas que fallaron — revisar arriba.");
} else {
  console.log("Todas las pruebas del Valor Mercenario pasaron.");
}
