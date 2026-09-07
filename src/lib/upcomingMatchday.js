// ---------- Próxima fecha (v3.7 — etapa 6, flujo administrativo mínimo) ----------
// Un borrador de UNA sola convocatoria futura por vez: fecha, modalidad (F8/F9)
// y convocados. Sin capitanes, presupuesto, draft ni equipos — eso es de otra
// etapa. Su único propósito acá es tener un momento seguro y explícito ("se
// confirmó la convocatoria") en el que asignar las misiones secretas, en vez
// de inventarlas para partidos ya jugados.
const STORAGE_KEY = "upcomingMatchday";

export async function loadUpcomingMatchday(storage) {
  try {
    const res = await storage.get(STORAGE_KEY, true);
    return res && res.value ? JSON.parse(res.value) : null;
  } catch (e) {
    return null; // no hay ninguna convocatoria pendiente todavía
  }
}

export async function saveUpcomingMatchday(storage, draft) {
  await storage.set(STORAGE_KEY, JSON.stringify(draft), true);
  return draft;
}

export async function clearUpcomingMatchday(storage) {
  try {
    await storage.delete(STORAGE_KEY, true);
  } catch (e) {
    /* si ya no existía, no hay nada que hacer */
  }
}

// Arma el "partido" (sin estadísticas) que se le pasa al motor de misiones
// para poder validar elegibilidad de posición y calcular cuántas fechas
// previas tiene cada convocado. `assignMissionIfNeeded` es quien además
// verifica que sea realmente una fecha futura y sin estadísticas.
export function draftAsShellMatch(draft, players) {
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  return {
    id: draft.id,
    date: draft.date,
    mode: draft.mode,
    participants: draft.convocadoIds
      .filter((id) => byId[id])
      .map((id) => ({ playerId: id, position: byId[id].position, team: null, goals: 0, assists: 0, ownGoals: 0 })),
    awards: [],
  };
}
