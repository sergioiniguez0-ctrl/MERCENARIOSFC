// ---------- Caminos de Potrero (v3.4 — etapa 5) ----------
// Trayectoria histórica del jugador, con nombres propios del fútbol de potrero
// del AMBA. NO son misiones, ni premios de fantasía, ni niveles de RPG: son una
// lectura de estadísticas reales que ya existen (goles, asistencias, partidos,
// reconocimientos, votos a figura). Función pura sobre `matches`/`votes` — no
// agrega nada a Firestore, no hay nada que "activar" ni "descubrir" (a diferencia
// de las Misiones Secretas de la etapa 6, que sí son ocultas hasta cumplirse).
import { isOfficialMode } from "./sportsConfig.js";
import { computeCommitment } from "./commitment.js";

// Cada camino tiene una lista de escalones (tiers), de menor a mayor. El título
// actual es el último escalón alcanzado; el próximo título es el siguiente.
export const POTRERO_PATHS_CONFIG = [
  {
    id: "goleador",
    name: "Camino del Goleador",
    statLabel: "Goles (partidos oficiales)",
    getValue: (s) => s.goals,
    tiers: [
      { min: 0, title: "La viene buscando" },
      { min: 5, title: "Romperredes" },
      { min: 10, title: "Artillero" },
      { min: 20, title: "Nueve de área" },
      { min: 35, title: "Goleador de raza" },
    ],
  },
  {
    id: "asistidor",
    name: "Camino del Asistidor",
    statLabel: "Asistencias (partidos oficiales)",
    getValue: (s) => s.assists,
    tiers: [
      { min: 0, title: "Buen socio" },
      { min: 5, title: "Metedor de pases" },
      { min: 10, title: "Asistidor" },
      { min: 20, title: "Mozo del gol" },
      { min: 35, title: "Dueño del último pase" },
    ],
  },
  {
    id: "siempre_esta",
    name: "Siempre está",
    statLabel: "Partidos jugados (todas las modalidades)",
    getValue: (s) => s.pjTotal,
    tiers: [
      { min: 0, title: "Recién llegado" },
      { min: 10, title: "Se hizo habitual" },
      { min: 25, title: "No falla" },
      { min: 50, title: "Siempre está" },
    ],
  },
  {
    id: "jugador_completo",
    name: "Jugador completo",
    statLabel: "Goles + asistencias (partidos oficiales)",
    getValue: (s) => s.goals + s.assists,
    tiers: [
      { min: 0, title: "Todavía no se destaca" },
      { min: 10, title: "Picante" },
      { min: 25, title: "Determinante" },
      { min: 45, title: "Jugador de dos pies" },
    ],
  },
  {
    id: "el_distinto",
    name: "El distinto",
    statLabel: "Reconocimientos del grupo (partidos oficiales)",
    getValue: (s) => s.awards,
    tiers: [
      { min: 0, title: "Uno del plantel" },
      { min: 2, title: "Tiene lo suyo" },
      { min: 5, title: "El distinto" },
      { min: 10, title: "Ídolo de la cancha" },
    ],
  },
  {
    id: "referente",
    name: "Referente",
    statLabel: "Votos a figura recibidos (partidos oficiales)",
    getValue: (s) => s.mvpVotes,
    tiers: [
      { min: 0, title: "Uno más" },
      { min: 5, title: "Tipo confiable" },
      { min: 15, title: "Referente del grupo" },
      { min: 30, title: "Todos lo quieren en su equipo" },
    ],
  },
  {
    id: "historico",
    name: "Histórico",
    statLabel: "Trayectoria general del jugador en el plantel",
    getValue: (s) => s.historicoScore,
    tiers: [
      { min: 0, title: "Cara nueva" },
      { min: 20, title: "Parte del plantel" },
      { min: 60, title: "Nombre propio en el grupo" },
      { min: 120, title: "Histórico del grupo" },
    ],
  },
];

// Agrupa las estadísticas reales que alimentan los Caminos. Todo sale de
// `matches`/`votes` ya guardados — nada nuevo que cargar.
export function computePotreroStats(player, matches, votes) {
  const official = (matches || []).filter((m) => isOfficialMode(m.mode));
  let goals = 0, assists = 0, awards = 0, mvpVotes = 0;
  official.forEach((m) => {
    const part = m.participants.find((p) => p.playerId === player.id);
    if (!part) return;
    goals += Number(part.goals) || 0;
    assists += Number(part.assists) || 0;
    awards += (m.awards || []).filter((a) => a.playerId === player.id).length;
    const mv = votes ? votes[m.id] : undefined;
    if (mv) mvpVotes += Object.values(mv).filter((v) => v === player.id).length;
  });
  const pjTotal = computeCommitment(player, matches).pj; // todas las modalidades (F5-F9)
  // "Trayectoria general": una lectura combinada, no una estadística nueva que se
  // muestre en ningún lado — solo decide en qué escalón de "Histórico" está.
  const historicoScore = pjTotal * 1 + goals * 2 + assists * 1.5 + awards * 3;
  return { goals, assists, awards, mvpVotes, pjTotal, historicoScore };
}

function resolveTier(pathConfig, value) {
  let currentIdx = 0;
  for (let i = 0; i < pathConfig.tiers.length; i++) {
    if (value >= pathConfig.tiers[i].min) currentIdx = i;
  }
  const current = pathConfig.tiers[currentIdx];
  const next = pathConfig.tiers[currentIdx + 1] || null;
  return {
    id: pathConfig.id,
    name: pathConfig.name,
    statLabel: pathConfig.statLabel,
    value,
    currentTitle: current.title,
    nextTitle: next ? next.title : null,
    nextRequirement: next ? next.min : null,
    isMaxed: !next,
  };
}

// Devuelve los 7 Caminos de Potrero del jugador, cada uno con su título actual,
// progreso y próximo título (o `isMaxed: true` si ya alcanzó el escalón más alto).
export function computePotreroPaths(player, matches, votes) {
  const stats = computePotreroStats(player, matches, votes);
  return POTRERO_PATHS_CONFIG.map((cfg) => resolveTier(cfg, cfg.getValue(stats)));
}
