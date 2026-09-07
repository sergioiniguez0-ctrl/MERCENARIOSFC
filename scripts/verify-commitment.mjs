// Pruebas verificables del Compromiso (v3.3) — confirma que el total de partidos
// que se muestra es el mismo que se usó para calcular el porcentaje, y que
// Fútbol 5/6/8/9 cuentan todos para la presencia.
import assert from "node:assert/strict";
import { computeCommitment } from "../src/lib/commitment.js";

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

check("commitment.pj es coherente con el porcentaje (pj / totalEligible)", () => {
  const player = { id: "p1" };
  const matches = [
    { id: "m1", date: "2026-01-01", mode: "Fútbol 5", participants: [{ playerId: "p1" }] },
    { id: "m2", date: "2026-01-08", mode: "Fútbol 8", participants: [{ playerId: "p1" }] },
    { id: "m3", date: "2026-01-15", mode: "Fútbol 6", participants: [{ playerId: "otro" }] }, // ausente
    { id: "m4", date: "2026-01-22", mode: "Fútbol 9", participants: [{ playerId: "p1" }] },
  ];
  const c = computeCommitment(player, matches);
  assert.equal(c.pj, 3, "debería haber jugado 3 de 4 (F5, F8, F9; faltó en el F6)");
  assert.equal(c.totalEligible, 4);
  assert.equal(c.percentage, Math.round((c.pj / c.totalEligible) * 100), "el porcentaje debe surgir exactamente de pj/totalEligible");
});

check("el Compromiso cuenta presencia en las 4 modalidades (F5, F6, F8 y F9)", () => {
  const player = { id: "p1" };
  const modes = ["Fútbol 5", "Fútbol 6", "Fútbol 8", "Fútbol 9"];
  const matches = modes.map((mode, i) => ({ id: `m${i}`, date: `2026-02-0${i + 1}`, mode, participants: [{ playerId: "p1" }] }));
  const c = computeCommitment(player, matches);
  assert.equal(c.pj, 4, "las 4 modalidades deben contar para el Compromiso");
});

console.log(`\n${passed}/2 pruebas pasaron.`);
if (process.exitCode) {
  console.error("Hay pruebas que fallaron — revisar arriba.");
} else {
  console.log("Todas las pruebas de Compromiso pasaron.");
}
