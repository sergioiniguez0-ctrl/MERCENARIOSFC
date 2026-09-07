// Pruebas verificables de los Caminos de Potrero (v3.4).
// Se ejecutan con: node scripts/verify-potrero-paths.mjs
import assert from "node:assert/strict";
import { computePotreroPaths, computePotreroStats, POTRERO_PATHS_CONFIG } from "../src/lib/potreroPaths.js";

function officialMatch(id, date, participants, awards = []) {
  return { id, date, mode: "Fútbol 8", participants, awards };
}
function participant(playerId, extra = {}) {
  return { playerId, position: "DC", team: "A", goals: 0, assists: 0, ...extra };
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

check("hay exactamente 7 Caminos de Potrero (el mínimo pedido)", () => {
  assert.equal(POTRERO_PATHS_CONFIG.length, 7);
});

check("el Camino del Goleador sube de título con más goles oficiales", () => {
  const player = { id: "p1" };
  const matches = Array.from({ length: 12 }, (_, i) => officialMatch(`m${i}`, `2026-01-${i + 1}`, [participant("p1", { goals: 1 })]));
  const paths = computePotreroPaths(player, matches, {});
  const goleador = paths.find((p) => p.id === "goleador");
  assert.equal(goleador.value, 12);
  assert.equal(goleador.currentTitle, "Artillero", `con 12 goles el título debería ser "Artillero", dio "${goleador.currentTitle}"`);
  assert.equal(goleador.nextTitle, "Nueve de área");
  assert.equal(goleador.nextRequirement, 20);
});

check("F5/F6 no suman al Camino del Goleador ni del Asistidor (solo estadísticas oficiales)", () => {
  const player = { id: "p1" };
  const matches = [
    { id: "f1", date: "2026-02-01", mode: "Fútbol 5", participants: [participant("p1", { goals: 50, assists: 50 })] },
  ];
  const stats = computePotreroStats(player, matches, {});
  assert.equal(stats.goals, 0, "los goles de Fútbol 5 no deben contarse en los Caminos");
  assert.equal(stats.assists, 0, "las asistencias de Fútbol 5 no deben contarse en los Caminos");
});

check('"Siempre está" sí cuenta partidos de todas las modalidades (F5-F9), a diferencia del resto', () => {
  const player = { id: "p1" };
  const matches = [
    { id: "m1", date: "2026-03-01", mode: "Fútbol 5", participants: [participant("p1")] },
    { id: "m2", date: "2026-03-08", mode: "Fútbol 8", participants: [participant("p1")] },
  ];
  const stats = computePotreroStats(player, matches, {});
  assert.equal(stats.pjTotal, 2, "debe contar los 2 partidos (F5 y F8)");
});

check("un jugador sin ningún partido queda en el primer escalón de todos los caminos, sin romperse", () => {
  const player = { id: "nuevo" };
  const paths = computePotreroPaths(player, [], {});
  paths.forEach((p) => {
    assert.equal(p.value, 0);
    assert.equal(p.currentTitle, POTRERO_PATHS_CONFIG.find((c) => c.id === p.id).tiers[0].title);
  });
});

check("al llegar exactamente al último escalón, isMaxed queda en true y no pide más", () => {
  const player = { id: "crack" };
  const matches = Array.from({ length: 35 }, (_, i) => officialMatch(`g${i}`, `2026-04-${(i % 28) + 1}-${i}`, [participant("crack", { goals: 1 })]));
  const paths = computePotreroPaths(player, matches, {});
  const goleador = paths.find((p) => p.id === "goleador");
  assert.equal(goleador.currentTitle, "Goleador de raza");
  assert.equal(goleador.isMaxed, true);
  assert.equal(goleador.nextTitle, null);
});

check("ningún camino usa lenguaje de XP/nivel/misión (solo título + estadística real)", () => {
  const paths = computePotreroPaths({ id: "x" }, [], {});
  paths.forEach((p) => {
    const keys = Object.keys(p);
    assert.ok(!keys.some((k) => /xp|nivel|level|mission|misio/i.test(k)));
  });
});

console.log(`\n${passed}/7 pruebas pasaron.`);
if (process.exitCode) {
  console.error("Hay pruebas que fallaron — revisar arriba.");
} else {
  console.log("Todas las pruebas de los Caminos de Potrero pasaron.");
}
