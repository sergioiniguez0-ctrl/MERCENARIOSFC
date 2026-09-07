// ---------- Misiones Secretas — persistencia y asignación (v3.8, etapa 6 FINAL) ----------
// Acá vive TODO lo asíncrono: leer/guardar en `window.storage` (Firestore), la
// asignación real (con `crypto.getRandomValues`) y la evaluación idempotente.
// secretMissions.js (el motor puro) no sabe nada de esto.
//
// CORRECCIÓN v3.7 (respecto a v3.6):
// - Cada asignación se guarda en su PROPIA clave de Firestore
//   (`missionAssignment:<matchId>_<playerId>`), no en un único array
//   compartido. Antes, procesar varios jugadores leía el array entero,
//   agregaba un registro y volvía a escribir el array completo — si dos
//   asignaciones se procesaban en paralelo (p. ej. `Promise.all` sobre varios
//   convocados), la segunda escritura podía pisar a la primera y perderla.
//   Con una clave por registro, cada `set()` es independiente: no hay
//   condición de carrera posible entre jugadores.
// - `assignMissionIfNeeded` ahora RECHAZA explícitamente:
//     a) partidos que no son F8/F9,
//     b) partidos que ya tienen alguna estadística cargada (goles, asistencias
//        o goles en contra > 0) — un partido "ya jugado",
//     c) partidos cuya fecha no es estrictamente POSTERIOR a todas las fechas
//        ya cargadas — un partido "histórico" insertado con fecha vieja.
//   Esto es lo que impide, a nivel de código (no solo de interfaz), asignar
//   misiones a partidos históricos, cerrados o sin convocatoria confirmada.
//
// CORRECCIÓN v3.8 (respecto a v3.7):
// - Ya NO se evalúan las misiones al guardar el partido vinculado. El partido
//   arranca con `votingOpen: true` (los votos se cargan después), así que
//   evaluar ahí mismo hacía que las misiones de tipo VOTE_COUNT expiraran
//   siempre con 0 votos. Ahora `evaluateAssignment` se llama recién al
//   CERRAR la votación, cuando los votos ya están completos. El partido
//   guarda `missionsLinked`/`missionPlayerIds` para saber a quién evaluar en
//   ese momento, aunque `upcomingMatchday` ya se haya borrado.
// - Se agregó `cancelAssignmentsForMatch`: al descartar una convocatoria ya
//   confirmada, sus asignaciones `active` pasan a `cancelled` (no se borran
//   silenciosamente ni quedan activas para siempre). Una asignación
//   `cancelled` no aparece como activa, completada ni fallida en ningún lado.
//
// ---------- LÍMITE DE SEGURIDAD REAL (sin cambios respecto a la entrega anterior) ----------
// Este proyecto NO tiene Firebase Auth: la sesión de administrador es un
// chequeo de contraseña que corre enteramente en el navegador (src/lib/auth.js)
// y todas las lecturas/escrituras a Firestore pasan por `window.storage`
// (src/lib/storagePolyfill.js) sin ningún token de identidad adjunto. Las
// reglas de Firestore, sean cuales sean hoy, NO PUEDEN distinguir
// "administrador" de "jugador" ni de "cualquier visitante": todos hablan con
// Firestore exactamente igual. Esta entrega NO cambia Firebase Auth ni las
// reglas de Firestore.
//
// Consecuencia concreta: alguien que abra la consola del navegador y use el
// SDK de Firebase (con el mismo `firebaseConfig` que ya viaja público en el
// build, como en cualquier app de Firebase del lado del cliente) puede leer
// cualquier documento `missionAssignment:*` completo, `missionSnapshot`
// incluido — exactamente igual que hoy puede leer `players` o `matches`. La
// interfaz normal de la app nunca muestra el contenido de una misión activa
// (`toPublicView` lo oculta salvo que ya esté `completed`), pero eso es una
// protección de interfaz, NO un control de acceso del lado del servidor.
export const SECURITY_LIMITATION_NOTICE =
  "Sin Firebase Auth, cualquier cliente que hable con Firestore directamente (por ejemplo desde la consola del navegador) puede leer el documento completo de una asignación, incluido el contenido de la misión. La interfaz normal de la app nunca lo muestra, pero esto no equivale a un control de acceso del lado del servidor. Esta entrega no modifica Firebase Auth ni las reglas de Firestore.";

import { SECRET_MISSIONS, MISSIONS_CATALOG_VERSION, CHECKERS, buildSquadFacts, sortOfficialMatches, minPriorMatchesFor } from "./secretMissions.js";
import { isOfficialMode, posGroupOf } from "./sportsConfig.js";

const KEY_PREFIX = "missionAssignment:";
const RECENT_WINDOW = 5; // últimas N asignaciones (de misiones repetibles) que no se repiten

function keyFor(matchId, playerId) {
  return `${KEY_PREFIX}${matchId}_${playerId}`;
}

async function loadAssignment(storage, matchId, playerId) {
  try {
    const res = await storage.get(keyFor(matchId, playerId), true);
    return res && res.value ? JSON.parse(res.value) : null;
  } catch (e) {
    return null; // esa clave todavía no existe: no hay asignación para ese partido+jugador
  }
}

async function saveAssignment(storage, record) {
  await storage.set(keyFor(record.matchId, record.playerId), JSON.stringify(record), true);
  return record;
}

// Trae TODAS las asignaciones de un jugador, leyendo cada clave por separado
// (una por partido). No hay ningún documento compartido que se pueda pisar.
export async function listAssignmentsForPlayer(storage, playerId) {
  const { keys } = await storage.list(KEY_PREFIX, true);
  const suffix = `_${playerId}`;
  const own = keys.filter((k) => k.endsWith(suffix));
  const records = await Promise.all(
    own.map(async (k) => {
      try {
        const res = await storage.get(k, true);
        return res && res.value ? JSON.parse(res.value) : null;
      } catch (e) {
        return null;
      }
    })
  );
  return records.filter(Boolean);
}

export async function listAllAssignments(storage) {
  const { keys } = await storage.list(KEY_PREFIX, true);
  const records = await Promise.all(
    keys.map(async (k) => {
      try {
        const res = await storage.get(k, true);
        return res && res.value ? JSON.parse(res.value) : null;
      } catch (e) {
        return null;
      }
    })
  );
  return records.filter(Boolean);
}

// Selección aleatoria REAL (no determinística, no reproducible a partir de
// playerId/matchId): usa el generador criptográfico del navegador (o de Node,
// en los tests). El resultado se persiste inmediatamente después de elegirse.
function randomIndex(maxExclusive) {
  if (maxExclusive <= 0) return 0;
  const arr = new Uint32Array(1);
  globalThis.crypto.getRandomValues(arr);
  return arr[0] % maxExclusive;
}

function difficultyTierFor(priorMatchesCount) {
  if (priorMatchesCount < 5) return ["facil"];
  if (priorMatchesCount < 15) return ["facil", "media"];
  return ["facil", "media", "dificil"];
}

function eligibleMissions({ playerGroup, priorMatchesCount, playerAssignments, relaxRecentWindow }) {
  const allowedDifficulties = difficultyTierFor(priorMatchesCount);
  const everAssignedIds = new Set(playerAssignments.map((a) => a.missionId));
  const recentIds = relaxRecentWindow
    ? []
    : playerAssignments
        .slice()
        .sort((a, b) => a.assignedAt - b.assignedAt)
        .slice(-RECENT_WINDOW)
        .map((a) => a.missionId);

  return SECRET_MISSIONS.filter((m) => {
    if (m.eligiblePositions && !m.eligiblePositions.includes(playerGroup)) return false;
    if (!allowedDifficulties.includes(m.difficulty)) return false;
    if (priorMatchesCount < minPriorMatchesFor(m)) return false;
    if (!m.repeatable && everAssignedIds.has(m.id)) return false; // no repetible: nunca más
    if (m.repeatable && recentIds.includes(m.id)) return false; // repetible: evitar ventana reciente
    return true;
  });
}

function hasAnyStat(match) {
  return match.participants.some((p) => (Number(p.goals) || 0) > 0 || (Number(p.assists) || 0) > 0 || (Number(p.ownGoals) || 0) > 0);
}

// Crea la asignación para (match, player) SI Y SOLO SI el partido es una fecha
// futura y sin jugar todavía — RECHAZA partidos históricos, cerrados o con
// estadísticas cargadas. IDEMPOTENTE: llamarla dos veces nunca crea una
// segunda misión ni cambia la ya asignada.
export async function assignMissionIfNeeded({ storage, match, player, allOfficialMatches, votes }) {
  if (!isOfficialMode(match.mode)) {
    throw new Error("Las misiones secretas solo se asignan en partidos oficiales (F8/F9).");
  }
  if (hasAnyStat(match)) {
    throw new Error("No se pueden asignar misiones a un partido que ya tiene estadísticas cargadas (partido ya jugado/cerrado).");
  }
  const others = (allOfficialMatches || []).filter((m) => m.id !== match.id);
  const isStrictlyFuture = others.every((m) => String(m.date) < String(match.date));
  if (!isStrictlyFuture) {
    throw new Error("Las misiones secretas solo se pueden asignar a una fecha posterior a todos los partidos oficiales ya cargados.");
  }

  const existing = await loadAssignment(storage, match.id, player.id);
  if (existing) return existing;

  const sorted = sortOfficialMatches([...others, match]);
  const idx = sorted.findIndex((m) => m.id === match.id);
  const priorMatchesCount = idx; // fechas oficiales del plantel antes de esta
  const playerGroup = posGroupOf(player.position);
  const playerAssignments = await listAssignmentsForPlayer(storage, player.id);

  let pool = eligibleMissions({ playerGroup, priorMatchesCount, playerAssignments, relaxRecentWindow: false });
  if (pool.length === 0) {
    // No hay margen respetando la ventana de "recientes": se relaja SOLO esa
    // ventana. La regla de no-repetibles nunca se relaja.
    pool = eligibleMissions({ playerGroup, priorMatchesCount, playerAssignments, relaxRecentWindow: true });
  }
  if (pool.length === 0) return null; // caso extremo: no queda ninguna misión elegible

  const chosen = pool[randomIndex(pool.length)];
  const record = {
    id: `${match.id}_${player.id}`,
    matchId: match.id,
    playerId: player.id,
    missionId: chosen.id,
    missionVersion: MISSIONS_CATALOG_VERSION,
    assignedAt: Date.now(),
    status: "active",
    completedAt: null,
    revealedAt: null,
    missionSnapshot: {
      title: chosen.name,
      description: chosen.description,
      revealText: chosen.revealText,
      type: chosen.type,
      params: chosen.params || {},
    },
  };
  return saveAssignment(storage, record);
}

// Comprueba UNA VEZ la misión de (matchId, playerId) cuando se cierra/carga el
// resultado del partido — IDEMPOTENTE: si ya estaba evaluada (completed o
// expired), no la vuelve a tocar. Editar el partido después tampoco la
// modifica, porque esta función no se vuelve a llamar sola para asignaciones
// ya evaluadas (eso lo decide quien la invoca, típicamente una sola vez al
// guardar el resultado).
export async function evaluateAssignment({ storage, matchId, playerId, allOfficialMatches, votes }) {
  const assignment = await loadAssignment(storage, matchId, playerId);
  if (!assignment) return null;
  if (assignment.status !== "active") return assignment;

  const facts = buildSquadFacts(allOfficialMatches, playerId, votes);
  const sorted = sortOfficialMatches(allOfficialMatches);
  const matchIdx = sorted.findIndex((m) => m.id === matchId);
  const checker = CHECKERS[assignment.missionSnapshot.type];
  const completed = matchIdx !== -1 && typeof checker === "function" && checker(facts, matchIdx, assignment.missionSnapshot.params || {});

  const now = Date.now();
  const updated = { ...assignment, status: completed ? "completed" : "expired", completedAt: completed ? now : null, revealedAt: completed ? now : null };
  return saveAssignment(storage, updated);
}

// Cancela (no borra) todas las asignaciones activas de una convocatoria que
// se descarta después de confirmada. Las ya evaluadas (completed/expired) no
// se tocan — solo se cancelan las que seguían `active`. Una asignación
// `cancelled` no aparece como activa, completada ni fallida en ningún lado.
export async function cancelAssignmentsForMatch(storage, matchId, playerIds) {
  const results = [];
  for (const playerId of playerIds) {
    const assignment = await loadAssignment(storage, matchId, playerId);
    if (!assignment) continue;
    if (assignment.status !== "active") {
      results.push(assignment); // ya evaluada: no se toca
      continue;
    }
    const updated = { ...assignment, status: "cancelled" };
    await saveAssignment(storage, updated);
    results.push(updated);
  }
  return results;
}

// Vista "pública": nunca expone `missionSnapshot` salvo que ya esté revelada
// (completed). Es la función que cualquier pantalla de jugador debería usar.
export function toPublicView(assignment) {
  if (!assignment) return null;
  if (assignment.status === "completed") return assignment;
  const { missionSnapshot, ...rest } = assignment;
  return rest;
}

// Solo las misiones YA CUMPLIDAS Y REVELADAS de un jugador — esto es lo único
// que se muestra en "Misiones ya descubiertas" del perfil.
export async function getRevealedMissions(storage, playerId) {
  const assignments = await listAssignmentsForPlayer(storage, playerId);
  return assignments
    .filter((a) => a.status === "completed")
    .map((a) => ({
      matchId: a.matchId,
      completedAt: a.completedAt,
      title: a.missionSnapshot.title,
      description: a.missionSnapshot.description,
      revealText: a.missionSnapshot.revealText,
    }));
}

// Para el indicador discreto "Tenés una misión activa para la próxima fecha" —
// nunca expone cuál es.
export async function hasActiveMission(storage, playerId) {
  const assignments = await listAssignmentsForPlayer(storage, playerId);
  return assignments.some((a) => a.status === "active");
}
