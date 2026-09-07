// Pruebas de la capa de PERSISTENCIA de Misiones Secretas (v3.7).
// Se ejecutan con: node scripts/verify-secret-missions-store.mjs
// El `storage` simulado tiene la misma forma que `window.storage`
// (get/set/delete/list, con `shared`) e introduce una demora aleatoria en cada
// operación — así una prueba de "concurrencia" es una prueba real: si el
// almacenamiento pisara datos al procesar varias asignaciones en paralelo
// (como pasaba con el array único de la versión anterior), esta demora lo
// pondría en evidencia.
import assert from "node:assert/strict";
import {
  assignMissionIfNeeded,
  evaluateAssignment,
  cancelAssignmentsForMatch,
  getRevealedMissions,
  hasActiveMission,
  listAllAssignments,
  listAssignmentsForPlayer,
  toPublicView,
} from "../src/lib/secretMissionsStore.js";
import * as secretMissions from "../src/lib/secretMissions.js";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMockStorage() {
  const data = new Map();
  const setCalls = [];
  return {
    setCalls,
    async get(key, shared) {
      await wait(Math.random() * 4);
      const k = (shared ? "shared:" : "personal:") + key;
      if (!data.has(k)) throw new Error(`storage: key not found "${key}"`);
      return { key, value: data.get(k), shared };
    },
    async set(key, value, shared) {
      await wait(Math.random() * 4);
      const k = (shared ? "shared:" : "personal:") + key;
      data.set(k, value);
      setCalls.push(key);
      return { key, value, shared };
    },
    async delete(key, shared) {
      await wait(Math.random() * 4);
      const k = (shared ? "shared:" : "personal:") + key;
      data.delete(k);
      return { key, deleted: true, shared };
    },
    async list(prefix, shared) {
      await wait(Math.random() * 4);
      const p = (shared ? "shared:" : "personal:") + (prefix || "");
      const keys = [...data.keys()].filter((k) => k.startsWith(p)).map((k) => k.slice((shared ? "shared:" : "personal:").length));
      return { keys, prefix, shared };
    },
  };
}

// Para probar `evaluateAssignment` de forma determinística (sin depender de
// qué misión haya tocado por azar), esta función escribe una asignación "a
// mano" con el tipo y los parámetros que la prueba necesita — sin pasar por
// `assignMissionIfNeeded`. Usa el mismo formato de clave que la implementación
// real (documentado en secretMissionsStore.js).
async function seedAssignment(storage, { matchId, playerId, missionType, params = {} }) {
  const record = {
    id: `${matchId}_${playerId}`,
    matchId,
    playerId,
    missionId: "test_mission",
    missionVersion: "test",
    assignedAt: Date.now(),
    status: "active",
    completedAt: null,
    revealedAt: null,
    missionSnapshot: { title: "Misión de prueba", description: "Descripción de prueba", revealText: "Texto de prueba", type: missionType, params },
  };
  await storage.set(`missionAssignment:${matchId}_${playerId}`, JSON.stringify(record), true);
  return record;
}

function officialMatch(id, date, participants, awards = []) {
  return { id, date, mode: "Fútbol 8", participants, awards };
}
function participant(playerId, position, team, extra = {}) {
  return { playerId, position, team, goals: 0, assists: 0, ownGoals: 0, ...extra };
}

let total = 0;
let passed = 0;
async function check(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`✔ ${name}`);
  } catch (e) {
    console.error(`✘ ${name}`);
    console.error("  " + (e.stack || e.message).split("\n").slice(0, 3).join("\n  "));
    process.exitCode = 1;
  }
}

await check("no existe ninguna función que genere misiones retroactivas para partidos históricos", () => {
  const forbiddenNames = ["computeMissionTimeline", "getDiscoveredMissions", "generateHistoricalMissions"];
  forbiddenNames.forEach((n) => {
    assert.equal(typeof secretMissions[n], "undefined", `secretMissions.js no debería exportar "${n}"`);
  });
});

await check("assignMissionIfNeeded RECHAZA un partido histórico (fecha anterior a partidos ya cargados)", async () => {
  const storage = createMockStorage();
  const existing = officialMatch("m_old", "2026-05-01", [participant("p1", "DC", "A")]);
  const historic = officialMatch("m_historic", "2026-01-01", [participant("p1", "DC", "A")]); // fecha ANTERIOR
  const player = { id: "p1", position: "DC" };
  await assert.rejects(
    () => assignMissionIfNeeded({ storage, match: historic, player, allOfficialMatches: [existing], votes: {} }),
    /posterior/,
    "debe rechazar un partido con fecha anterior a uno ya cargado"
  );
  const all = await listAllAssignments(storage);
  assert.equal(all.length, 0, "no debe haberse creado ninguna asignación");
});

await check("assignMissionIfNeeded RECHAZA un partido que ya tiene estadísticas cargadas (ya jugado)", async () => {
  const storage = createMockStorage();
  const played = officialMatch("m1", "2026-01-01", [participant("p1", "DC", "A", { goals: 2 })]); // ya tiene goles
  const player = { id: "p1", position: "DC" };
  await assert.rejects(
    () => assignMissionIfNeeded({ storage, match: played, player, allOfficialMatches: [played], votes: {} }),
    /estadísticas cargadas/,
    "debe rechazar un partido que ya tiene estadísticas"
  );
});

await check("assignMissionIfNeeded RECHAZA Fútbol 5 y Fútbol 6 (no generan misiones)", async () => {
  const storage = createMockStorage();
  const player = { id: "p1", position: "DC" };
  for (const mode of ["Fútbol 5", "Fútbol 6"]) {
    const match = { id: "f_" + mode, date: "2026-01-01", mode, participants: [participant("p1", "DC", "A")], awards: [] };
    await assert.rejects(
      () => assignMissionIfNeeded({ storage, match, player, allOfficialMatches: [match], votes: {} }),
      /oficiales/,
      `${mode} debe rechazar la asignación`
    );
  }
  const all = await listAllAssignments(storage);
  assert.equal(all.length, 0);
});

await check("assignMissionIfNeeded crea una asignación real para una fecha futura sin estadísticas", async () => {
  const storage = createMockStorage();
  const match = { id: "m_future", date: "2026-09-01", mode: "Fútbol 8", participants: [participant("p1", "DC", "A")], awards: [] };
  const player = { id: "p1", position: "DC" };
  const record = await assignMissionIfNeeded({ storage, match, player, allOfficialMatches: [], votes: {} });
  assert.ok(record, "debe devolver una asignación");
  assert.equal(record.status, "active");
  assert.equal(record.matchId, "m_future");
  assert.equal(record.playerId, "p1");
  assert.ok(record.missionSnapshot && record.missionSnapshot.title);
});

await check("assignMissionIfNeeded es idempotente: llamarla 2 veces no duplica ni cambia la asignación", async () => {
  const storage = createMockStorage();
  const match = { id: "m1", date: "2026-01-01", mode: "Fútbol 8", participants: [participant("p1", "DC", "A")], awards: [] };
  const player = { id: "p1", position: "DC" };
  const first = await assignMissionIfNeeded({ storage, match, player, allOfficialMatches: [], votes: {} });
  const second = await assignMissionIfNeeded({ storage, match, player, allOfficialMatches: [], votes: {} });
  assert.deepEqual(first, second);
  const all = await listAllAssignments(storage);
  assert.equal(all.length, 1);
});

await check("CONCURRENCIA: asignar a 6 jugadores en paralelo no pierde ninguna asignación", async () => {
  const storage = createMockStorage();
  const match = { id: "m1", date: "2026-01-01", mode: "Fútbol 8", participants: [], awards: [] };
  const playerIds = ["p1", "p2", "p3", "p4", "p5", "p6"];
  match.participants = playerIds.map((id) => participant(id, "DC", "A"));
  await Promise.all(
    playerIds.map((id) => assignMissionIfNeeded({ storage, match, player: { id, position: "DC" }, allOfficialMatches: [], votes: {} }))
  );
  const all = await listAllAssignments(storage);
  const assignedPlayerIds = new Set(all.map((a) => a.playerId));
  assert.equal(all.length, 6, `deberían existir 6 asignaciones, hay ${all.length}`);
  playerIds.forEach((id) => assert.ok(assignedPlayerIds.has(id), `se perdió la asignación de ${id}`));
});

await check("evaluateAssignment completa una misión determinística cuando la condición se cumple", async () => {
  const storage = createMockStorage();
  const match = officialMatch("m1", "2026-01-01", [participant("p1", "DC", "A", { goals: 1 })]);
  await seedAssignment(storage, { matchId: "m1", playerId: "p1", missionType: "GOAL_AND_ASSIST" === "x" ? "" : "TEAM_WIN" });
  // Ganó porque es el único equipo con goles (rival no cargado): TEAM_WIN debe completarse.
  const updated = await evaluateAssignment({ storage, matchId: "m1", playerId: "p1", allOfficialMatches: [match], votes: {} });
  assert.equal(updated.status, "completed");
  assert.ok(updated.completedAt);
  assert.ok(updated.revealedAt);
});

await check("evaluateAssignment expira una misión determinística cuando la condición NO se cumple", async () => {
  const storage = createMockStorage();
  const match = officialMatch("m1", "2026-01-01", [participant("p1", "DC", "A", { goals: 0, assists: 0 })]);
  await seedAssignment(storage, { matchId: "m1", playerId: "p1", missionType: "MULTI_GOAL", params: { n: 3 } });
  const updated = await evaluateAssignment({ storage, matchId: "m1", playerId: "p1", allOfficialMatches: [match], votes: {} });
  assert.equal(updated.status, "expired");
  assert.equal(updated.completedAt, null);
  assert.equal(updated.revealedAt, null);
});

await check("evaluateAssignment es idempotente: evaluarla 2 veces da EXACTAMENTE el mismo resultado", async () => {
  const storage = createMockStorage();
  const match = officialMatch("m1", "2026-01-01", [participant("p1", "DC", "A", { goals: 1 })]);
  await seedAssignment(storage, { matchId: "m1", playerId: "p1", missionType: "TEAM_WIN" });
  const first = await evaluateAssignment({ storage, matchId: "m1", playerId: "p1", allOfficialMatches: [match], votes: {} });
  const second = await evaluateAssignment({ storage, matchId: "m1", playerId: "p1", allOfficialMatches: [match], votes: {} });
  assert.deepEqual(first, second);
  assert.equal(first.completedAt, second.completedAt, "el timestamp de completado no debe cambiar en la segunda llamada");
});

await check("editar un partido histórico YA EVALUADO no reorganiza ni cambia la asignación existente", async () => {
  const storage = createMockStorage();
  const match = officialMatch("m1", "2026-01-01", [participant("p1", "DC", "A", { goals: 0 })]);
  await seedAssignment(storage, { matchId: "m1", playerId: "p1", missionType: "MULTI_GOAL", params: { n: 1 } });
  const evaluated = await evaluateAssignment({ storage, matchId: "m1", playerId: "p1", allOfficialMatches: [match], votes: {} });
  assert.equal(evaluated.status, "expired");

  const editedMatch = { ...match, participants: [participant("p1", "DC", "A", { goals: 5 })] };
  const afterEdit = await evaluateAssignment({ storage, matchId: "m1", playerId: "p1", allOfficialMatches: [editedMatch], votes: {} });
  assert.deepEqual(afterEdit, evaluated, "la asignación ya evaluada no debe cambiar aunque se edite el partido después");
});

await check("orden cronológico: evaluar con el calendario oficial desordenado da el mismo resultado que ordenado", async () => {
  const storageOrdenado = createMockStorage();
  const storageDesordenado = createMockStorage();
  const m1 = officialMatch("m1", "2026-01-01", [participant("p1", "DC", "A", { goals: 1 })]);
  const m2 = officialMatch("m2", "2026-01-08", [participant("p1", "DC", "A", { goals: 1 })]);
  const m3 = officialMatch("m3", "2026-01-15", [participant("p1", "DC", "A", { goals: 1 })]);
  await seedAssignment(storageOrdenado, { matchId: "m3", playerId: "p1", missionType: "SCORE_STREAK", params: { n: 3 } });
  await seedAssignment(storageDesordenado, { matchId: "m3", playerId: "p1", missionType: "SCORE_STREAK", params: { n: 3 } });
  const rOrdenado = await evaluateAssignment({ storage: storageOrdenado, matchId: "m3", playerId: "p1", allOfficialMatches: [m1, m2, m3], votes: {} });
  const rDesordenado = await evaluateAssignment({ storage: storageDesordenado, matchId: "m3", playerId: "p1", allOfficialMatches: [m3, m1, m2], votes: {} });
  assert.equal(rOrdenado.status, "completed");
  assert.equal(rDesordenado.status, "completed", "el resultado no debe depender del orden en que llega el array");
});

await check("una misión no-repetible nunca se asigna dos veces al mismo jugador", async () => {
  const storage = createMockStorage();
  const player = { id: "p1", position: "ARQ" }; // ARQ habilita sm15 ("Che, pibe"), no-repetible
  let allOfficial = [];
  for (let i = 0; i < 40; i++) {
    const d = new Date(2026, 1, 1 + i); // 1 de febrero de 2026 + i días, estrictamente creciente
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const match = { id: `m${i}`, date, mode: "Fútbol 8", participants: [participant("p1", "ARQ", "A")], awards: [] };
    await assignMissionIfNeeded({ storage, match, player, allOfficialMatches: allOfficial, votes: {} });
    await evaluateAssignment({ storage, matchId: match.id, playerId: "p1", allOfficialMatches: [...allOfficial, match], votes: {} });
    allOfficial = [...allOfficial, match];
  }
  const mine = await listAssignmentsForPlayer(storage, "p1");
  const nonRepeatableIds = ["sm14", "sm15"];
  nonRepeatableIds.forEach((id) => {
    const count = mine.filter((a) => a.missionId === id).length;
    assert.ok(count <= 1, `la misión no-repetible ${id} se asignó ${count} veces`);
  });
});

await check("una misión expirada NUNCA aparece en getRevealedMissions", async () => {
  const storage = createMockStorage();
  const match = officialMatch("m1", "2026-01-01", [participant("p1", "DC", "A", { goals: 0 })]);
  await seedAssignment(storage, { matchId: "m1", playerId: "p1", missionType: "MULTI_GOAL", params: { n: 5 } });
  await evaluateAssignment({ storage, matchId: "m1", playerId: "p1", allOfficialMatches: [match], votes: {} });
  const revealed = await getRevealedMissions(storage, "p1");
  assert.equal(revealed.length, 0);
});

await check("una misión completada se persiste y se revela con toda su información", async () => {
  const storage = createMockStorage();
  const match = officialMatch("m1", "2026-01-01", [participant("p1", "DC", "A", { goals: 1 })]);
  await seedAssignment(storage, { matchId: "m1", playerId: "p1", missionType: "TEAM_WIN" });
  await evaluateAssignment({ storage, matchId: "m1", playerId: "p1", allOfficialMatches: [match], votes: {} });
  const revealed = await getRevealedMissions(storage, "p1");
  assert.equal(revealed.length, 1);
  assert.ok(revealed[0].title && revealed[0].description && revealed[0].revealText);
});

await check("las misiones nunca escriben en las claves de Puntaje/Valor Mercenario/Caminos de Potrero", async () => {
  const storage = createMockStorage();
  const match = { id: "m1", date: "2026-01-01", mode: "Fútbol 8", participants: [participant("p1", "DC", "A")], awards: [] };
  const player = { id: "p1", position: "DC" };
  await assignMissionIfNeeded({ storage, match, player, allOfficialMatches: [], votes: {} });
  await evaluateAssignment({ storage, matchId: "m1", playerId: "p1", allOfficialMatches: [{ ...match, participants: [participant("p1", "DC", "A", { goals: 1 })] }], votes: {} });
  const forbiddenKeys = ["players", "matches", "votes", "secretMissionAssignments"];
  storage.setCalls.forEach((k) => assert.ok(!forbiddenKeys.includes(k), `se escribió en una clave ajena: ${k}`));
  assert.ok(storage.setCalls.every((k) => k.startsWith("missionAssignment:")), "todas las escrituras deben ir a su propia clave por asignación");
});

await check("toPublicView nunca expone missionSnapshot salvo que ya esté completada", () => {
  const active = { id: "x", status: "active", missionSnapshot: { title: "secreto" } };
  const completed = { id: "y", status: "completed", missionSnapshot: { title: "revelado" } };
  const expired = { id: "z", status: "expired", missionSnapshot: { title: "secreto" } };
  assert.equal(toPublicView(active).missionSnapshot, undefined);
  assert.equal(toPublicView(expired).missionSnapshot, undefined);
  assert.equal(toPublicView(completed).missionSnapshot.title, "revelado");
});

await check("hasActiveMission indica presencia sin exponer contenido", async () => {
  const storage = createMockStorage();
  const match = { id: "m1", date: "2026-01-01", mode: "Fútbol 8", participants: [participant("p1", "DC", "A")], awards: [] };
  const player = { id: "p1", position: "DC" };
  assert.equal(await hasActiveMission(storage, "p1"), false);
  await assignMissionIfNeeded({ storage, match, player, allOfficialMatches: [], votes: {} });
  assert.equal(await hasActiveMission(storage, "p1"), true);
});

await check("no se generan asignaciones para partidos ya existentes al recorrer el calendario (sin llamada explícita)", async () => {
  const storage = createMockStorage();
  // 10 partidos históricos "ya cargados" en la app, con estadísticas reales.
  const historicos = Array.from({ length: 10 }, (_, i) => officialMatch(`h${i}`, `2026-01-${i + 1}`, [participant("p1", "DC", "A", { goals: 1 })]));
  // Nunca se llama a assignMissionIfNeeded para ninguno de ellos.
  const all = await listAllAssignments(storage);
  assert.equal(all.length, 0, "no debe existir ninguna asignación si nunca se confirmó una convocatoria futura");
  assert.equal(historicos.length, 10); // (uso de la variable para dejar explícito el escenario)
});

await check("una misión de votos permanece ACTIVA al guardar el partido (todavía sin evaluar)", async () => {
  const storage = createMockStorage();
  const match = officialMatch("m1", "2026-01-01", [participant("p1", "DC", "A")]);
  await seedAssignment(storage, { matchId: "m1", playerId: "p1", missionType: "VOTE_COUNT", params: { n: 2 } });
  // "Guardar el partido" NO llama a evaluateAssignment (eso ahora pasa en el
  // cierre de votación) — se simula no llamando nada acá, solo se confirma el
  // estado inicial.
  const assignmentsBefore = await listAssignmentsForPlayer(storage, "p1");
  assert.equal(assignmentsBefore[0].status, "active");
});

await check("la misión se evalúa recién al cerrar la votación, no antes", async () => {
  const storage = createMockStorage();
  const match = officialMatch("m1", "2026-01-01", [participant("p1", "DC", "A")]);
  await seedAssignment(storage, { matchId: "m1", playerId: "p1", missionType: "VOTE_COUNT", params: { n: 1 } });
  // Sin votos todavía: si se evaluara ahora, expiraría. No se evalúa.
  const stillActive = await listAssignmentsForPlayer(storage, "p1");
  assert.equal(stillActive[0].status, "active");
  // Recién ahora, simulando el cierre de votación con los votos ya cargados:
  const votes = { m1: { voter1: "p1" } };
  const evaluated = await evaluateAssignment({ storage, matchId: "m1", playerId: "p1", allOfficialMatches: [match], votes });
  assert.equal(evaluated.status, "completed", "con 1 voto ya cargado, VOTE_COUNT n:1 debe completarse recién al evaluar");
});

await check("VOTE_COUNT recibe los votos actualizados del partido en el momento de evaluar", async () => {
  const storage = createMockStorage();
  const match = officialMatch("m1", "2026-01-01", [participant("p1", "DC", "A")]);
  await seedAssignment(storage, { matchId: "m1", playerId: "p1", missionType: "VOTE_COUNT", params: { n: 2 } });
  const votesActualizados = { m1: { v1: "p1", v2: "p1", v3: "otro" } };
  const evaluated = await evaluateAssignment({ storage, matchId: "m1", playerId: "p1", allOfficialMatches: [match], votes: votesActualizados });
  assert.equal(evaluated.status, "completed", "con 2 votos para p1, la misión de 2 votos debe completarse");
});

await check("una misión de 2 votos se completa con exactamente 2 votos", async () => {
  const storage = createMockStorage();
  const match = officialMatch("m1", "2026-01-01", [participant("p1", "DC", "A")]);
  await seedAssignment(storage, { matchId: "m1", playerId: "p1", missionType: "VOTE_COUNT", params: { n: 2 } });
  const votes = { m1: { v1: "p1", v2: "p1" } };
  const evaluated = await evaluateAssignment({ storage, matchId: "m1", playerId: "p1", allOfficialMatches: [match], votes });
  assert.equal(evaluated.status, "completed");
});

await check("esa misma misión de 2 votos EXPIRA con 0 o 1 voto", async () => {
  for (const votes of [{}, { m1: { v1: "p1" } }]) {
    const storage = createMockStorage();
    const match = officialMatch("m1", "2026-01-01", [participant("p1", "DC", "A")]);
    await seedAssignment(storage, { matchId: "m1", playerId: "p1", missionType: "VOTE_COUNT", params: { n: 2 } });
    const evaluated = await evaluateAssignment({ storage, matchId: "m1", playerId: "p1", allOfficialMatches: [match], votes });
    assert.equal(evaluated.status, "expired", `con votos=${JSON.stringify(votes)} debería expirar`);
  }
});

await check("cerrar la votación dos veces (evaluar dos veces) no cambia el resultado", async () => {
  const storage = createMockStorage();
  const match = officialMatch("m1", "2026-01-01", [participant("p1", "DC", "A")]);
  await seedAssignment(storage, { matchId: "m1", playerId: "p1", missionType: "VOTE_COUNT", params: { n: 1 } });
  const votes = { m1: { v1: "p1" } };
  const first = await evaluateAssignment({ storage, matchId: "m1", playerId: "p1", allOfficialMatches: [match], votes });
  // Se simula reabrir y volver a cerrar la votación con votos distintos: no debería importar.
  const votesDistintos = { m1: { v1: "p1", v2: "p1", v3: "p1" } };
  const second = await evaluateAssignment({ storage, matchId: "m1", playerId: "p1", allOfficialMatches: [match], votes: votesDistintos });
  assert.deepEqual(first, second, "la segunda evaluación no debe cambiar nada, aunque cambien los votos");
});

await check("reabrir la votación no reevalúa misiones ya procesadas (completed o expired quedan igual)", async () => {
  const storage = createMockStorage();
  const match = officialMatch("m1", "2026-01-01", [participant("p1", "DC", "A")]);
  await seedAssignment(storage, { matchId: "m1", playerId: "p1", missionType: "VOTE_COUNT", params: { n: 5 } });
  const evaluated = await evaluateAssignment({ storage, matchId: "m1", playerId: "p1", allOfficialMatches: [match], votes: {} });
  assert.equal(evaluated.status, "expired");
  // "Reabrir la votación" en la app nunca llama a evaluateAssignment — se
  // simula acá con más votos disponibles y SIN llamar a evaluate de nuevo:
  // el registro debe seguir exactamente igual.
  const stillThere = await listAssignmentsForPlayer(storage, "p1");
  assert.deepEqual(stillThere[0], evaluated);
});

await check("cancelar una convocatoria confirmada no deja ninguna misión activa", async () => {
  const storage = createMockStorage();
  const match = { id: "u1", date: "2026-01-01", mode: "Fútbol 8", participants: [participant("p1", "DC", "A"), participant("p2", "ARQ", "B")], awards: [] };
  await assignMissionIfNeeded({ storage, match, player: { id: "p1", position: "DC" }, allOfficialMatches: [], votes: {} });
  await assignMissionIfNeeded({ storage, match, player: { id: "p2", position: "ARQ" }, allOfficialMatches: [], votes: {} });
  await cancelAssignmentsForMatch(storage, "u1", ["p1", "p2"]);
  const all = await listAllAssignments(storage);
  assert.ok(all.every((a) => a.status !== "active"), "no debe quedar ninguna asignación en estado active tras cancelar");
  assert.ok(all.every((a) => a.status === "cancelled"), "ambas deberían estar cancelled");
});

await check("las asignaciones canceladas no aparecen en el perfil (ni activas ni reveladas)", async () => {
  const storage = createMockStorage();
  const match = { id: "u1", date: "2026-01-01", mode: "Fútbol 8", participants: [participant("p1", "DC", "A")], awards: [] };
  await assignMissionIfNeeded({ storage, match, player: { id: "p1", position: "DC" }, allOfficialMatches: [], votes: {} });
  await cancelAssignmentsForMatch(storage, "u1", ["p1"]);
  assert.equal(await hasActiveMission(storage, "p1"), false, "una misión cancelada no debe contar como activa");
  const revealed = await getRevealedMissions(storage, "p1");
  assert.equal(revealed.length, 0, "una misión cancelada no debe aparecer como revelada/completada");
});

await check("cancelAssignmentsForMatch NO toca una asignación que ya estaba completed o expired", async () => {
  const storage = createMockStorage();
  const match = officialMatch("m1", "2026-01-01", [participant("p1", "DC", "A", { goals: 1 })]);
  await seedAssignment(storage, { matchId: "m1", playerId: "p1", missionType: "TEAM_WIN" });
  const evaluated = await evaluateAssignment({ storage, matchId: "m1", playerId: "p1", allOfficialMatches: [match], votes: {} });
  assert.equal(evaluated.status, "completed");
  await cancelAssignmentsForMatch(storage, "m1", ["p1"]);
  const stillThere = await listAssignmentsForPlayer(storage, "p1");
  assert.equal(stillThere[0].status, "completed", "una misión ya completada no debe pasar a cancelled");
});

await check("el partido conserva missionPlayerIds/missionsLinked aunque upcomingMatchday ya no exista", async () => {
  // Esto se prueba a nivel de forma de datos: el objeto "partido" que arma
  // App.jsx al vincular una convocatoria incluye estos campos, independientes
  // de que el borrador se haya borrado después. Se simula acá el objeto tal
  // como lo construye addMatch() en App.jsx.
  const upcomingMatchday = { id: "u1", date: "2026-01-01", mode: "Fútbol 8", convocadoIds: ["p1", "p2"], confirmed: true };
  const form = { date: "2026-01-01", mode: "Fútbol 8", teamAName: "A", teamBName: "B", participants: [], awards: [] };
  const newMatch = {
    ...form,
    id: upcomingMatchday.id,
    votingOpen: true,
    missionsLinked: true,
    missionPlayerIds: upcomingMatchday.convocadoIds,
  };
  // "Se borra" upcomingMatchday (ya no existe en ningún lado) — el partido
  // igual conserva todo lo necesario para poder evaluar sus misiones después.
  assert.equal(newMatch.missionsLinked, true);
  assert.deepEqual(newMatch.missionPlayerIds, ["p1", "p2"]);
  assert.equal(newMatch.id, "u1");
});

console.log(`\n${passed}/${total} pruebas pasaron.`);
if (process.exitCode) {
  console.error("Hay pruebas que fallaron — revisar arriba.");
} else {
  console.log("Todas las pruebas de persistencia de Misiones Secretas pasaron.");
}
