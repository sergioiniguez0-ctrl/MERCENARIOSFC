// Pruebas del MOTOR PURO de Misiones Secretas (v3.7).
// Se ejecutan con: node scripts/verify-secret-missions-engine.mjs
// Ninguna prueba usa un "if" para decidir si comprueba algo: cada `check()`
// hace una aserción incondicional. El contador de resultados nunca se escribe
// a mano — se lleva con una variable que se incrementa en cada `check()`.
import assert from "node:assert/strict";
import { SECRET_MISSIONS, MISSION_TYPES, CHECKERS, buildSquadFacts, sortOfficialMatches, minPriorMatchesFor, isMissionWellFormed } from "../src/lib/secretMissions.js";

function officialMatch(id, date, participants, awards = []) {
  return { id, date, mode: "Fútbol 8", participants, awards };
}
function participant(playerId, position, team, extra = {}) {
  return { playerId, position, team, goals: 0, assists: 0, ownGoals: 0, ...extra };
}

let total = 0;
let passed = 0;
function check(name, fn) {
  total++;
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

// ---------- Catálogo: 50 IDs únicos, todos bien formados ----------
check("existen 50 IDs de misión, todos únicos", () => {
  assert.equal(SECRET_MISSIONS.length, 50);
  const ids = new Set(SECRET_MISSIONS.map((m) => m.id));
  assert.equal(ids.size, 50);
});

check("cada una de las 50 misiones tiene un verificador registrado y campos válidos", () => {
  const validDifficulties = new Set(["facil", "media", "dificil"]);
  const validGroups = new Set(["ARQ", "DEF", "MED", "DEL"]);
  SECRET_MISSIONS.forEach((m) => {
    assert.ok(isMissionWellFormed(m), `${m.id} no está bien formada`);
    assert.ok(validDifficulties.has(m.difficulty), `${m.id} tiene dificultad inválida: ${m.difficulty}`);
    if (m.eligiblePositions) {
      m.eligiblePositions.forEach((g) => assert.ok(validGroups.has(g), `${m.id} tiene un grupo de posición inválido: ${g}`));
    }
    assert.equal(typeof m.repeatable, "boolean", `${m.id} debe declarar repeatable como booleano`);
  });
});

// ---------- Prueba PARAMETRIZADA: recorre las 50 misiones, una por una ----------
SECRET_MISSIONS.forEach((m) => {
  check(`[auditoría] ${m.id} "${m.name}": checker válido y ejecutable sin explotar`, () => {
    const allOfficial = Array.from({ length: 12 }, (_, i) =>
      officialMatch(`m${i}`, `2026-01-${i + 1}`, [
        participant("p1", "DC", "A", { goals: i % 2, assists: i % 3 === 0 ? 1 : 0 }),
        participant("rival", "DC", "B", { goals: i % 4 === 0 ? 1 : 0 }),
      ], i % 5 === 0 ? [{ label: "Figura", playerId: "p1" }] : [])
    );
    const facts = buildSquadFacts(allOfficial, "p1", {});
    const checker = CHECKERS[m.type];
    assert.equal(typeof checker, "function", `tipo sin checker: ${m.type}`);
    for (let idx = 0; idx < facts.length; idx++) {
      const result = checker(facts, idx, m.params || {});
      assert.equal(typeof result, "boolean", `el checker de ${m.id} debe devolver boolean, devolvió ${typeof result}`);
    }
    assert.equal(typeof minPriorMatchesFor(m), "number");
  });
});

check("ninguna descripción o texto de revelación atribuye acciones no registradas", () => {
  const forbiddenPhrases = [/gracias a lo suyo/i, /puso el cuerpo/i, /dominó/i, /recuperó pelotas/i, /defendió bien/i];
  SECRET_MISSIONS.forEach((m) => {
    const text = `${m.description} ${m.revealText}`;
    forbiddenPhrases.forEach((re) => assert.ok(!re.test(text), `${m.id} usa una frase no demostrable: "${text}"`));
  });
});

check("hay variedad de posiciones elegibles: no todo está concentrado en delanteros", () => {
  const byGroup = { ARQ: 0, DEF: 0, MED: 0, DEL: 0, todas: 0 };
  SECRET_MISSIONS.forEach((m) => {
    if (!m.eligiblePositions) byGroup.todas++;
    else m.eligiblePositions.forEach((g) => byGroup[g]++);
  });
  assert.ok(byGroup.ARQ >= 3, `muy pocas misiones para arqueros: ${byGroup.ARQ}`);
  assert.ok(byGroup.DEF >= 3, `muy pocas misiones para defensores: ${byGroup.DEF}`);
  assert.ok(byGroup.DEL <= SECRET_MISSIONS.length * 0.3, "demasiadas misiones concentradas en delanteros");
});

// ---------- Orden cronológico ----------
check("buildSquadFacts ordena por fecha SIN IMPORTAR el orden de entrada del array", () => {
  const inOrder = [
    officialMatch("m1", "2026-02-01", [participant("p1", "DC", "A", { goals: 1 })]),
    officialMatch("m2", "2026-02-08", [participant("p1", "DC", "A", { goals: 1 })]),
    officialMatch("m3", "2026-02-15", [participant("p1", "DC", "A", { goals: 1 })]),
  ];
  const shuffled = [inOrder[2], inOrder[0], inOrder[1]]; // deliberadamente fuera de orden
  const factsFromOrder = buildSquadFacts(inOrder, "p1", {});
  const factsFromShuffled = buildSquadFacts(shuffled, "p1", {});
  assert.deepEqual(factsFromOrder.map((f) => f.match.id), ["m1", "m2", "m3"]);
  assert.deepEqual(factsFromShuffled.map((f) => f.match.id), ["m1", "m2", "m3"], "debe quedar en orden cronológico aunque entre desordenado");
  assert.equal(CHECKERS[MISSION_TYPES.SCORE_STREAK](factsFromShuffled, 2, { n: 3 }), true, "la racha debe calcularse igual de bien con el array desordenado");
});

check("sortOfficialMatches es estable y determinística (mismo resultado siempre)", () => {
  const matches = [
    officialMatch("b", "2026-01-02", []),
    officialMatch("a", "2026-01-01", []),
    officialMatch("c", "2026-01-03", []),
  ];
  const r1 = sortOfficialMatches(matches).map((m) => m.id);
  const r2 = sortOfficialMatches([...matches].reverse()).map((m) => m.id);
  assert.deepEqual(r1, ["a", "b", "c"]);
  assert.deepEqual(r2, ["a", "b", "c"]);
});

// ---------- Rachas: deben cortarse con una ausencia (presencia, goles, asistencias, victorias, vallas invictas) ----------
check("una ausencia corta la racha de presencias (PRESENCE_STREAK)", () => {
  const allOfficial = [
    officialMatch("m1", "2026-02-01", [participant("p1", "DC", "A")]),
    officialMatch("m2", "2026-02-08", [participant("p1", "DC", "A")]),
    officialMatch("m3", "2026-02-15", [participant("otro", "DC", "A")]), // p1 ausente
    officialMatch("m4", "2026-02-22", [participant("p1", "DC", "A")]),
  ];
  const facts = buildSquadFacts(allOfficial, "p1", {});
  assert.equal(CHECKERS[MISSION_TYPES.PRESENCE_STREAK](facts, 1, { n: 2 }), true, "hasta m2 debería tener racha de 2");
  assert.equal(CHECKERS[MISSION_TYPES.PRESENCE_STREAK](facts, 3, { n: 2 }), false, "en m4 la racha se cortó en m3, solo lleva 1");
});

check("PRESENCE_STREAK NO es la cantidad total de partidos jugados en la carrera", () => {
  const allOfficial = [
    officialMatch("m1", "2026-03-01", [participant("p1", "DC", "A")]),
    officialMatch("m2", "2026-03-08", [participant("p1", "DC", "A")]),
    officialMatch("m3", "2026-03-15", [participant("otro", "DC", "A")]),
    officialMatch("m4", "2026-03-22", [participant("p1", "DC", "A")]),
    officialMatch("m5", "2026-03-29", [participant("p1", "DC", "A")]),
  ];
  const facts = buildSquadFacts(allOfficial, "p1", {});
  assert.equal(CHECKERS[MISSION_TYPES.PRESENCE_STREAK](facts, 4, { n: 5 }), false, "5 partidos jugados en total no es una racha de 5 consecutivos");
  assert.equal(CHECKERS[MISSION_TYPES.PRESENCE_STREAK](facts, 4, { n: 2 }), true, "la racha actual (m4-m5) es de 2");
});

check("una ausencia corta la racha goleadora y asistidora", () => {
  const allOfficial = [
    officialMatch("m1", "2026-04-01", [participant("p1", "DC", "A", { goals: 1, assists: 1 })]),
    officialMatch("m2", "2026-04-08", [participant("otro", "DC", "A", { goals: 1 })]), // p1 ausente
    officialMatch("m3", "2026-04-15", [participant("p1", "DC", "A", { goals: 1, assists: 1 })]),
  ];
  const facts = buildSquadFacts(allOfficial, "p1", {});
  assert.equal(CHECKERS[MISSION_TYPES.SCORE_STREAK](facts, 2, { n: 2 }), false, "la ausencia en m2 corta la racha goleadora");
  assert.equal(CHECKERS[MISSION_TYPES.ASSIST_STREAK](facts, 2, { n: 2 }), false, "la ausencia en m2 corta la racha asistidora");
});

check("una ausencia corta la racha de victorias", () => {
  const allOfficial = [
    officialMatch("w1", "2026-04-01", [participant("p1", "DC", "A", { goals: 1 }), participant("r", "DC", "B")]),
    officialMatch("w2", "2026-04-08", [participant("otro", "DC", "A", { goals: 1 }), participant("r", "DC", "B")]), // p1 ausente
    officialMatch("w3", "2026-04-15", [participant("p1", "DC", "A", { goals: 1 }), participant("r", "DC", "B")]),
  ];
  const facts = buildSquadFacts(allOfficial, "p1", {});
  assert.equal(CHECKERS[MISSION_TYPES.WIN_STREAK](facts, 2, { n: 2 }), false, "la ausencia en w2 corta la racha ganadora");
});

check("una ausencia corta la racha de vallas invictas (CLEAN_SHEET_STREAK)", () => {
  const allOfficial = [
    officialMatch("c1", "2026-05-01", [participant("p1", "ARQ", "A"), participant("r", "DC", "B")]), // valla invicta
    officialMatch("c2", "2026-05-08", [participant("otro", "ARQ", "A"), participant("r", "DC", "B")]), // p1 ausente
    officialMatch("c3", "2026-05-15", [participant("p1", "ARQ", "A"), participant("r", "DC", "B")]), // valla invicta
  ];
  const facts = buildSquadFacts(allOfficial, "p1", {});
  assert.equal(CHECKERS[MISSION_TYPES.CLEAN_SHEET_STREAK](facts, 2, { n: 2 }), false, "la ausencia en c2 corta la racha de vallas invictas");
});

// ---------- Misiones antes mal conectadas, ahora corregidas ----------
check('"Arquero de fierro" (CLEAN_SHEET_STREAK) exige vallas invictas CONSECUTIVAS, no una sola', () => {
  const allOfficial = [
    officialMatch("m1", "2026-05-01", [participant("p1", "ARQ", "A"), participant("r", "DC", "B", { goals: 1 })]),
    officialMatch("m2", "2026-05-08", [participant("p1", "ARQ", "A"), participant("r", "DC", "B")]),
    officialMatch("m3", "2026-05-15", [participant("p1", "ARQ", "A"), participant("r", "DC", "B")]),
  ];
  const facts = buildSquadFacts(allOfficial, "p1", {});
  assert.equal(CHECKERS[MISSION_TYPES.CLEAN_SHEET_STREAK](facts, 1, { n: 2 }), false, "en m2 todavía es solo 1 valla invicta consecutiva");
  assert.equal(CHECKERS[MISSION_TYPES.CLEAN_SHEET_STREAK](facts, 2, { n: 2 }), true, "en m3 ya son 2 vallas invictas consecutivas");
});

check('"Doble voto" (VOTE_COUNT n:2) exige al menos 2 votos, no 1', () => {
  const m = officialMatch("m1", "2026-06-01", [participant("p1", "DC", "A")]);
  const facts1voto = buildSquadFacts([m], "p1", { m1: { a: "p1" } });
  const facts2votos = buildSquadFacts([m], "p1", { m1: { a: "p1", b: "p1" } });
  assert.equal(CHECKERS[MISSION_TYPES.VOTE_COUNT](facts1voto, 0, { n: 2 }), false, "con 1 voto no debería cumplirse la de 2");
  assert.equal(CHECKERS[MISSION_TYPES.VOTE_COUNT](facts2votos, 0, { n: 2 }), true, "con 2 votos sí debería cumplirse");
});

check('"Segunda chance" (ASSIST_AFTER_DROUGHT) exige una sequía real, no una asistencia reciente', () => {
  const conSequia = [
    officialMatch("m1", "2026-07-01", [participant("p1", "MED", "A", { assists: 0 })]),
    officialMatch("m2", "2026-07-08", [participant("p1", "MED", "A", { assists: 0 })]),
    officialMatch("m3", "2026-07-15", [participant("p1", "MED", "A", { assists: 0 })]),
    officialMatch("m4", "2026-07-22", [participant("p1", "MED", "A", { assists: 1 })]),
  ];
  const sinSequia = [
    officialMatch("n1", "2026-07-01", [participant("p1", "MED", "A", { assists: 1 })]),
    officialMatch("n2", "2026-07-08", [participant("p1", "MED", "A", { assists: 0 })]),
    officialMatch("n3", "2026-07-15", [participant("p1", "MED", "A", { assists: 0 })]),
    officialMatch("n4", "2026-07-22", [participant("p1", "MED", "A", { assists: 1 })]),
  ];
  const factsCon = buildSquadFacts(conSequia, "p1", {});
  const factsSin = buildSquadFacts(sinSequia, "p1", {});
  assert.equal(CHECKERS[MISSION_TYPES.ASSIST_AFTER_DROUGHT](factsCon, 3, { droughtMatches: 3 }), true, "con 3 fechas sin asistir antes, debe cumplirse");
  assert.equal(CHECKERS[MISSION_TYPES.ASSIST_AFTER_DROUGHT](factsSin, 3, { droughtMatches: 3 }), false, "si asistió dentro de la ventana de sequía, no debe cumplirse");
});

console.log(`\n${passed}/${total} pruebas pasaron.`);
if (process.exitCode) {
  console.error("Hay pruebas que fallaron — revisar arriba.");
} else {
  console.log("Todas las pruebas del motor de Misiones Secretas pasaron.");
}
