import React, { useState, useEffect, useMemo } from "react";
import {
  Trophy, Users, CalendarDays, Vote, TrendingUp, TrendingDown, Minus, Plus, X, Check, Lock, Shield,
  ChevronRight, Loader2, Shirt, Goal, Medal, Circle, Home, BarChart3, Settings,
  Star, Crown, Target, Sparkles, ShieldCheck, Pencil, Trash2, LogOut, Flame, Clock, Award,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { verifyAdminCredentials } from "./lib/auth";

const POSITIONS = [
  { id: "ARQ", label: "Arquero" },
  { id: "DEF", label: "Defensor" },
  { id: "MED", label: "Mediocampista" },
  { id: "DEL", label: "Delantero" },
];
const MODES = ["Fútbol 5", "Fútbol 6", "Fútbol 8", "Fútbol 9"];
// Puntuación ponderada por modalidad (goles/asistencias reales -> puntos ponderados).
// F9 y F8: 1 punto por gol/asistencia · F6 y F5: 0,5 puntos por gol/asistencia.
const MODE_POINT_VALUE = {
  "Fútbol 9": 1,
  "Fútbol 8": 1,
  "Fútbol 6": 0.5,
  "Fútbol 5": 0.5,
};
function modePointValue(mode) {
  return MODE_POINT_VALUE[mode] ?? 1;
}

// ---------- Modalidades oficiales vs. modalidades de ranking (regla del club) ----------
// F8 y F9 son las ÚNICAS modalidades que generan estadísticas oficiales: partidos jugados,
// goles, asistencias, MVP, promedio, logros, récords, cartas y estadísticas históricas.
// F5 y F6 NO generan estadísticas oficiales: no suman goles, asistencias, MVP, promedio,
// récords ni logros. Solo cuentan presencia y dan un pequeño aporte al Ranking (ver
// F56_* más abajo). Esta separación se aplica en TODAS las funciones de cálculo del
// archivo: cada una que agrega datos "oficiales" filtra primero por isOfficialMode().
const OFFICIAL_MODES = ["Fútbol 8", "Fútbol 9"];
const RANKING_ONLY_MODES = ["Fútbol 5", "Fútbol 6"];
function isOfficialMode(mode) {
  return OFFICIAL_MODES.includes(mode);
}
function isRankingOnlyMode(mode) {
  return RANKING_ONLY_MODES.includes(mode);
}
function onlyOfficialMatches(matches) {
  return (matches || []).filter((m) => isOfficialMode(m.mode));
}

// Aporte de F5/F6 al Ranking general: NO son estadísticas oficiales, son solo puntos
// chicos de ranking. Por partido, un jugador puede sumar como máximo 0,3:
//  +0,1 por presencia (jugar el partido)
//  +0,1 si su equipo ganó
//  +0,1 si fue el goleador del partido (máximo goleador; empatados suman todos)
const F56_PRESENCE_INC = 0.1;
const F56_WIN_INC = 0.1;
const F56_SCORER_INC = 0.1;
const F56_MATCH_CAP = 0.3;

// Jugadores que nunca pueden eliminarse del plantel (regla fija del club).
// "Cristian 8" era un jugador placeholder de la seed y ya se eliminó del sistema:
// NO está protegido. Solo el jugador real "Cris 8" no se puede borrar.
// Se compara por nombre normalizado para cubrir variantes de escritura.
const PROTECTED_PLAYER_NAMES = ["cris 8"];
function normalizedPlayerName(name) {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function isProtectedPlayer(player) {
  if (!player) return false;
  return PROTECTED_PLAYER_NAMES.includes(normalizedPlayerName(player.name));
}
// 1 voto MVP recibido = 0,1 puntos acumulados históricamente.
const MVP_VOTE_POINT = 0.1;
const MAX_PLAYERS = 30;
const AWARD_INC = 0.5;
const WIN_INC = 0.5;
const GOAL_INC = 1;
const ASSIST_INC = 0.6;
const CLEAN_SHEET_INC = 0.5;
const VOTE_INC = 0.5;
const VOTE_CAP = 3;
const OWN_GOAL_DEC = 1;
const BASE_RATING = 6;
const RATING_MIN = 2;
const RATING_MAX = 10;
const QUICK_AWARDS = [
  "Mejor arquero",
  "Mejor defensa",
  "Mejor mediocampista",
  "Mejor delantero",
  "Mejor pase",
  "Mejor gambeta",
  "Mejor dupla central",
  "El más áspero de la fecha",
];
const FORMATIONS = {
  "Fútbol 5": { ARQ: 1, DEF: 2, MED: 1, DEL: 1 },
  "Fútbol 6": { ARQ: 1, DEF: 2, MED: 2, DEL: 1 },
  "Fútbol 8": { ARQ: 1, DEF: 3, MED: 2, DEL: 2 },
  "Fútbol 9": { ARQ: 1, DEF: 3, MED: 2, DEL: 3 },
};
function formationLabel(mode) {
  const f = FORMATIONS[mode] || FORMATIONS["Fútbol 9"];
  return `${f.ARQ}-${f.DEF}-${f.MED}-${f.DEL}`;
}

const SEED_PLAYERS = [
  { number: 1, name: "Lee son", position: "DEL" },
  { number: 2, name: "Zicario", position: "DEF" },
  { number: 3, name: "Cristian Romero", position: "DEF" },
  { number: 4, name: "Sebas", position: "MED" },
  { number: 5, name: "Fabri", position: "MED" },
  { number: 6, name: "Bruno", position: "DEL" },
  { number: 7, name: "Sergio", position: "DEF" },
  { number: 8, name: "Teddy", position: "DEL" },
  { number: 10, name: "Chuwa", position: "DEF" },
  { number: 11, name: "Galo", position: "MED" },
  { number: 12, name: "Nacho", position: "MED" },
  { number: 13, name: "Leo", position: "DEL" },
  { number: 14, name: "Cris Brat", position: "MED" },
  { number: 15, name: "Alexis", position: "DEL" },
  { number: 16, name: "Martin", position: "MED" },
  { number: 17, name: "Zuko", position: "DEL" },
  { number: 18, name: "Cris", position: "MED" },
];

const SEED_MATCHES = [
  {
    id: "m20260720",
    date: "2026-07-20",
    mode: "Fútbol 9",
    teamAName: "Local",
    teamBName: "Visitante",
    votingOpen: true,
    participants: [
      { playerId: "p5", position: "MED", team: "A", goals: 0, assists: 2, yellow: false, red: false },
      { playerId: "p12", position: "MED", team: "A", goals: 0, assists: 1, yellow: false, red: false },
      { playerId: "p1", position: "DEL", team: "A", goals: 2, assists: 1, yellow: false, red: false },
      { playerId: "p13", position: "DEL", team: "A", goals: 2, assists: 0, yellow: false, red: false },
      { playerId: "p18", position: "MED", team: "A", goals: 0, assists: 0, yellow: false, red: false },
      { playerId: "p3", position: "DEF", team: "A", goals: 0, assists: 0, yellow: false, red: false },
      { playerId: "p15", position: "DEL", team: "A", goals: 3, assists: 1, yellow: false, red: false },
      { playerId: "p7", position: "DEF", team: "B", goals: 0, assists: 2, yellow: false, red: false },
      { playerId: "p11", position: "MED", team: "B", goals: 0, assists: 1, yellow: false, red: false },
      { playerId: "p8", position: "DEL", team: "B", goals: 3, assists: 2, yellow: false, red: false },
      { playerId: "p6", position: "ARQ", team: "B", goals: 0, assists: 0, yellow: false, red: false },
      { playerId: "p14", position: "MED", team: "B", goals: 0, assists: 0, yellow: false, red: false },
      { playerId: "p16", position: "MED", team: "B", goals: 1, assists: 0, yellow: false, red: false },
      { playerId: "p2", position: "DEF", team: "B", goals: 0, assists: 0, yellow: false, red: false },
      { playerId: "p4", position: "MED", team: "B", goals: 1, assists: 1, yellow: false, red: false },
      { playerId: "p10", position: "DEF", team: "B", goals: 0, assists: 0, yellow: false, red: false },
      { playerId: "p17", position: "DEL", team: "B", goals: 3, assists: 0, yellow: false, red: false },
    ],
    awards: [
      { label: "Mejor pase", playerId: "p5" },
      { label: "Mejor gambeta", playerId: "p13" },
      { label: "Mejor defensa", playerId: "p3" },
      { label: "Mejor pase", playerId: "p7" },
      { label: "Mejor gambeta", playerId: "p11" },
      { label: "Mejor defensa", playerId: "p2" },
      { label: "Mejor arquero", playerId: "p6" },
    ],
  },
];

function posLabel(id) {
  return POSITIONS.find((p) => p.id === id)?.label || id;
}

function nextNumber(players) {
  const used = new Set(players.map((p) => p.number));
  for (let n = 1; n <= MAX_PLAYERS; n++) if (!used.has(n)) return n;
  return players.length + 1;
}

function teamGoalsFor(match, team) {
  const own = match.participants.filter((x) => x.team === team).reduce((s, x) => s + (Number(x.goals) || 0), 0);
  const rivalOwnGoals = match.participants.filter((x) => x.team !== team).reduce((s, x) => s + (Number(x.ownGoals) || 0), 0);
  return own + rivalOwnGoals;
}

// Aporte de Ranking de partidos F5/F6 (NO son estadísticas oficiales).
// Devuelve un mapa playerId -> { presencias, bonus } acumulado SOLO con partidos F5/F6.
function computeF56Bonus(players, matches) {
  const map = {};
  players.forEach((p) => (map[p.id] = { presencias: 0, bonus: 0 }));
  (matches || [])
    .filter((m) => isRankingOnlyMode(m.mode))
    .forEach((m) => {
      const teamAGoals = teamGoalsFor(m, "A");
      const teamBGoals = teamGoalsFor(m, "B");
      const winner = teamAGoals > teamBGoals ? "A" : teamBGoals > teamAGoals ? "B" : null;
      const maxGoals = Math.max(0, ...m.participants.map((p) => Number(p.goals) || 0));
      m.participants.forEach((part) => {
        if (!map[part.playerId]) return;
        let inc = F56_PRESENCE_INC;
        if (winner && part.team === winner) inc += F56_WIN_INC;
        if (maxGoals > 0 && (Number(part.goals) || 0) === maxGoals) inc += F56_SCORER_INC;
        inc = Math.min(inc, F56_MATCH_CAP);
        map[part.playerId].presencias += 1;
        map[part.playerId].bonus = Math.round((map[part.playerId].bonus + inc) * 100) / 100;
      });
    });
  return map;
}

function matchRating(match, playerId, mvpVotes) {
  const p = match.participants.find((x) => x.playerId === playerId);
  if (!p) return null;
  const teamGoals = teamGoalsFor(match, p.team);
  const rivalGoals = teamGoalsFor(match, p.team === "A" ? "B" : "A");
  const goals = Number(p.goals) || 0;
  const assists = Number(p.assists) || 0;
  const ownGoals = Number(p.ownGoals) || 0;
  const win = teamGoals > rivalGoals;
  const cleanSheet = (p.position === "ARQ" || p.position === "DEF") && rivalGoals === 0;
  const votes = mvpVotes ? Object.values(mvpVotes).filter((v) => v === playerId).length : 0;
  const awards = (match.awards || []).filter((a) => a.playerId === playerId);
  let rating = BASE_RATING;
  rating += goals * GOAL_INC;
  rating += assists * ASSIST_INC;
  rating += cleanSheet ? CLEAN_SHEET_INC : 0;
  rating += win ? WIN_INC : 0;
  rating += Math.min(votes, VOTE_CAP) * VOTE_INC;
  rating += awards.length * AWARD_INC;
  rating -= ownGoals * OWN_GOAL_DEC;
  rating = Math.min(RATING_MAX, Math.max(RATING_MIN, rating));
  return { rating, goals, assists, ownGoals, votes, awards, win, cleanSheet, teamGoals, rivalGoals };
}

function buildTeamOfMatch(match, players, votes) {
  const formation = FORMATIONS[match.mode] || FORMATIONS["Fútbol 9"];
  const byPos = { ARQ: [], DEF: [], MED: [], DEL: [] };
  match.participants.forEach((p) => {
    const r = matchRating(match, p.playerId, votes[match.id]);
    const pl = players.find((x) => x.id === p.playerId);
    if (!r || !pl) return;
    const bucket = byPos[p.position] ? p.position : "MED";
    byPos[bucket].push({ playerId: p.playerId, name: pl.name, number: pl.number, rating: r.rating });
  });
  Object.keys(byPos).forEach((k) => byPos[k].sort((a, b) => b.rating - a.rating));
  const team = {};
  Object.entries(formation).forEach(([pos, count]) => {
    team[pos] = byPos[pos].slice(0, count);
  });
  return team;
}

// ---------- Helpers de presentación (no alteran ninguna regla de puntaje) ----------

function ratingColor(avg) {
  if (avg >= 8) return "#00C853";
  if (avg >= 7) return "#0D6EFD";
  if (avg >= 6.2) return "#FFD54F";
  return "#9CA3AF";
}

function initials(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function seasonLabel(matches) {
  if (!matches || matches.length === 0) return `Temporada ${new Date().getFullYear()}`;
  const years = matches.map((m) => new Date(m.date + "T00:00:00").getFullYear());
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? `Temporada ${min}` : `Temporada ${min}/${max}`;
}

function computeStatsLeaders(players, totals, matches, votes) {
  // Goleadores, asistidores, MVP, vallas invictas, récords y logros son SIEMPRE
  // estadísticas oficiales: se calculan únicamente con partidos F8/F9.
  matches = onlyOfficialMatches(matches);
  const withPj = players
    .map((p) => ({ p, t: totals[p.id] || { pj: 0, goals: 0, assists: 0, votes: 0, ownGoals: 0, score: 0, goalsW: 0, assistsW: 0, mvpPoints: 0, offensive: 0, presenciasF56: 0, rankingBonus: 0 } }))
    .filter((x) => x.t.pj > 0);

  const topScorer = [...withPj].sort((a, b) => b.t.goals - a.t.goals)[0];
  const topAssist = [...withPj].sort((a, b) => b.t.assists - a.t.assists)[0];
  const mostMVP = [...withPj].sort((a, b) => b.t.votes - a.t.votes)[0];
  const mostMatches = [...withPj].sort((a, b) => b.t.pj - a.t.pj)[0];
  const highestAvg = [...withPj].sort((a, b) => b.t.score / b.t.pj - a.t.score / a.t.pj)[0];
  const mostOffensive = [...withPj].sort((a, b) => (b.t.offensive || 0) - (a.t.offensive || 0))[0];

  const keepers = withPj.filter((x) => x.p.position === "ARQ");
  const cleanSheetsMap = {};
  matches.forEach((m) => {
    const mv = votes[m.id];
    m.participants.forEach((part) => {
      if (part.position !== "ARQ") return;
      const r = matchRating(m, part.playerId, mv);
      if (r && r.cleanSheet) cleanSheetsMap[part.playerId] = (cleanSheetsMap[part.playerId] || 0) + 1;
    });
  });
  const bestKeeper = [...keepers].sort((a, b) => (cleanSheetsMap[b.p.id] || 0) - (cleanSheetsMap[a.p.id] || 0))[0];

  const breakout = [...withPj].filter((x) => x.t.pj <= 3).sort((a, b) => b.t.score / b.t.pj - a.t.score / a.t.pj)[0];

  // 📚 Récords históricos del club: mejor marca individual en un partido.
  let bestSingleGoal = null, bestSingleAssist = null;
  matches.forEach((m) => {
    m.participants.forEach((part) => {
      const pl = players.find((x) => x.id === part.playerId);
      if (!pl) return;
      const g = Number(part.goals) || 0;
      const a = Number(part.assists) || 0;
      if (!bestSingleGoal || g > bestSingleGoal.value) bestSingleGoal = { p: pl, t: totals[pl.id], value: g };
      if (!bestSingleAssist || a > bestSingleAssist.value) bestSingleAssist = { p: pl, t: totals[pl.id], value: a };
    });
  });

  // Racha goleadora y logros: requieren recorrer el historial de cada jugador.
  const withAch = withPj.map((x) => ({ ...x, ach: computeAchievements(x.p, matches, votes) }));
  const bestStreak = [...withAch].sort((a, b) => b.ach.maxGoalStreak - a.ach.maxGoalStreak)[0];
  const mostAchievements = [...withAch]
    .sort((a, b) => b.ach.list.filter((i) => i.unlocked).length - a.ach.list.filter((i) => i.unlocked).length)[0];

  return {
    topScorer, topAssist, mostMVP, mostMatches, highestAvg, bestKeeper, cleanSheetsMap, breakout,
    mostOffensive, bestSingleGoal, bestSingleAssist, bestStreak, mostAchievements,
  };
}

function idealTeamAllTime(ranking) {
  const formation = { ARQ: 1, DEF: 3, MED: 2, DEL: 3 };
  const byPos = { ARQ: [], DEF: [], MED: [], DEL: [] };
  ranking.forEach((p) => {
    if (p.pj > 0 && byPos[p.position]) byPos[p.position].push(p);
  });
  Object.keys(byPos).forEach((k) => byPos[k].sort((a, b) => b.avg - a.avg));
  const team = {};
  Object.entries(formation).forEach(([pos, count]) => {
    team[pos] = byPos[pos].slice(0, count);
  });
  return team;
}

// ---------- Perfil individual: logros, nivel y tendencia (solo lectura, no tocan el puntaje) ----------
// El Promedio de Rendimiento que se muestra en la carta es SIEMPRE score/pj — el mismo
// número que ya ordena el Ranking. No existe una fórmula paralela.

function computeAchievements(player, matches, votes) {
  // Los logros se calculan únicamente con partidos oficiales (F8/F9).
  matches = onlyOfficialMatches(matches);
  let maxGoalsMatch = 0, maxAssistsMatch = 0, mvpCount = 0, mvpStreak = 0, maxMvpStreak = 0, cleanSheets = 0, prevMvp = false, bestRating = 0;
  let goalStreak = 0, maxGoalStreak = 0, hasPerfectMatch = false;
  [...matches].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach((m) => {
    const part = m.participants.find((p) => p.playerId === player.id);
    if (!part) return;
    const partGoals = Number(part.goals) || 0;
    const partAssists = Number(part.assists) || 0;
    maxGoalsMatch = Math.max(maxGoalsMatch, partGoals);
    maxAssistsMatch = Math.max(maxAssistsMatch, partAssists);
    if (partGoals > 0) {
      goalStreak++;
      maxGoalStreak = Math.max(maxGoalStreak, goalStreak);
    } else {
      goalStreak = 0;
    }
    const mv = votes[m.id] || {};
    const counts = {};
    Object.values(mv).forEach((v) => (counts[v] = (counts[v] || 0) + 1));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const isMvpThisMatch = top && top[0] === player.id && top[1] > 0;
    if (isMvpThisMatch) {
      mvpCount++;
      mvpStreak = prevMvp ? mvpStreak + 1 : 1;
      maxMvpStreak = Math.max(maxMvpStreak, mvpStreak);
      prevMvp = true;
      if (partGoals > 0 && partAssists > 0) hasPerfectMatch = true;
    } else {
      mvpStreak = 0;
      prevMvp = false;
    }
    const r = matchRating(m, player.id, mv);
    if (r) {
      if (r.cleanSheet) cleanSheets++;
      bestRating = Math.max(bestRating, r.rating);
    }
  });
  const totalGoals = matches.reduce((s, m) => {
    const part = m.participants.find((p) => p.playerId === player.id);
    return s + (Number(part?.goals) || 0);
  }, 0);
  const totalAssists = matches.reduce((s, m) => {
    const part = m.participants.find((p) => p.playerId === player.id);
    return s + (Number(part?.assists) || 0);
  }, 0);
  const mvpVotesTotal = matches.reduce((s, m) => {
    const mv = votes[m.id] || {};
    return s + Object.values(mv).filter((v) => v === player.id).length;
  }, 0);
  const isLeyenda = mvpCount >= 3 && totalGoals + totalAssists >= 25;
  const list = [
    { id: "gol1", label: "Primer gol", icon: Goal, unlocked: totalGoals >= 1, color: "#0D6EFD" },
    { id: "hat", label: "Hat-trick", icon: Flame, unlocked: maxGoalsMatch >= 3, color: "#FFD54F" },
    { id: "poker", label: "Póker (4 goles en un partido)", icon: Flame, unlocked: maxGoalsMatch >= 4, color: "#FFD54F" },
    { id: "manita", label: "Manita (5 goles en un partido)", icon: Flame, unlocked: maxGoalsMatch >= 5, color: "#FFD54F" },
    { id: "depredador", label: "Depredador (goles históricos)", icon: Flame, unlocked: totalGoals >= 20, color: "#EF4444" },
    { id: "asist1", label: "Primer pase gol", icon: Target, unlocked: totalAssists >= 1, color: "#00C853" },
    { id: "maestro", label: "Maestro del pase (3 asist. en un partido)", icon: Target, unlocked: maxAssistsMatch >= 3, color: "#00C853" },
    { id: "asistHist", label: "Asistente histórico", icon: Target, unlocked: totalAssists >= 10, color: "#00C853" },
    { id: "potm", label: "Jugador del partido", icon: Crown, unlocked: mvpCount >= 1, color: "#FFD54F" },
    { id: "streak", label: "Racha de MVP", icon: Sparkles, unlocked: maxMvpStreak >= 2, color: "#0D6EFD" },
    { id: "perfecto", label: "Partido perfecto (MVP + gol + asistencia)", icon: Sparkles, unlocked: hasPerfectMatch, color: "#0D6EFD" },
    { id: "def", label: "Mejor defensor", icon: ShieldCheck, unlocked: cleanSheets >= 2, color: "#00C853" },
    { id: "leyenda", label: "Leyenda Mercenarios", icon: Crown, unlocked: isLeyenda, color: "#FFD54F" },
    { id: "keeper", label: "Mejor arquero", icon: Lock, unlocked: false, comingSoon: true, color: "#6b7280" },
  ];
  return { list, maxGoalsMatch, maxAssistsMatch, maxMvpStreak, maxGoalStreak, bestRating, cleanSheets, totalGoals, totalAssists, mvpVotesTotal };
}

// Nivel = trayectoria en el plantel, NO calidad de juego. No usa goles/asistencias/votos a propósito.
function computeLevel(t, matches, player, achievementsUnlockedCount) {
  const playerMatches = matches.filter((m) => m.participants.some((p) => p.playerId === player.id)).sort((a, b) => new Date(a.date) - new Date(b.date));
  const teamLatest = [...matches].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  let weeksInTeam = 0;
  if (playerMatches[0] && teamLatest) {
    const days = (new Date(teamLatest.date) - new Date(playerMatches[0].date)) / 86400000;
    weeksInTeam = Math.max(0, Math.round(days / 7));
  }
  const xp = Math.max(0, t.pj * 15 + weeksInTeam * 3 + achievementsUnlockedCount * 20);
  return { xp, level: 1 + Math.floor(xp / 100), progress: xp % 100, weeksInTeam };
}

// Tendencia: forma reciente (últimos partidos) contra el historial previo del mismo jugador.
function computeTrend(player, matches, votes) {
  // La tendencia se basa en la nota por partido (matchRating), que depende de goles/
  // asistencias/etc. Solo partidos oficiales (F8/F9) para no mezclar modalidades.
  matches = onlyOfficialMatches(matches);
  const ratings = matches
    .filter((m) => m.participants.some((p) => p.playerId === player.id))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((m) => matchRating(m, player.id, votes[m.id]).rating);
  if (ratings.length < 3) return { status: "sin-datos" };
  const recentN = Math.min(2, Math.floor(ratings.length / 2));
  const recent = ratings.slice(-recentN);
  const prior = ratings.slice(0, ratings.length - recentN);
  const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const delta = avg(recent) - avg(prior);
  let status = "estable";
  if (delta >= 0.15) status = "alza";
  else if (delta <= -0.15) status = "baja";
  return { status, delta };
}

const TREND_META = {
  alza: { emoji: "🟢", label: "En alza", color: "#00C853" },
  estable: { emoji: "🟡", label: "Estable", color: "#FFD54F" },
  baja: { emoji: "🔴", label: "En baja", color: "#EF4444" },
  "sin-datos": { emoji: "⚪", label: "Necesita más partidos", color: "#6b7280" },
};

function tierFromAvg(avg, pj, isMvpLeader) {
  if (pj === 0) return "bronce";
  if (avg >= 8.5 || (isMvpLeader && avg >= 7)) return "especial";
  if (avg >= 7.5) return "oro";
  if (avg >= 6.5) return "plata";
  return "bronce";
}

const CARD_TIERS = {
  bronce: { label: "Bronce", emoji: "🥉", ring: "#D97706", grad: "linear-gradient(160deg, rgba(217,119,6,0.35), #1b1108 70%)" },
  plata: { label: "Plata", emoji: "🥈", ring: "#CBD5E1", grad: "linear-gradient(160deg, rgba(203,213,225,0.30), #14171c 70%)" },
  oro: { label: "Oro", emoji: "🥇", ring: "#FFD54F", grad: "linear-gradient(160deg, rgba(255,213,79,0.35), #1a1608 70%)" },
  especial: { label: "Especial MVP", emoji: "⭐", ring: "#0D6EFD", grad: "linear-gradient(160deg, rgba(13,110,253,0.45), rgba(0,200,83,0.15) 55%, #0a0d11 100%)" },
};

// ---------- Helpers nuevos v2.0: forma reciente, movimiento en la tabla, jugador del mes ----------
// Todos son de solo lectura: reutilizan matchRating/computeAchievements existentes y no
// alteran ningún cálculo de puntaje ni la estructura de datos guardada en Firestore.

function computeRecentForm(playerId, matches, votes, n = 5) {
  // Forma reciente = notas de partidos oficiales (F8/F9) únicamente.
  matches = onlyOfficialMatches(matches);
  return [...matches]
    .filter((m) => m.participants.some((p) => p.playerId === playerId))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-n)
    .map((m) => ({ id: m.id, date: m.date, rating: matchRating(m, playerId, votes[m.id])?.rating ?? 0 }));
}

function computeMatchAvgRating(match, votes) {
  const mv = votes[match.id];
  const ratings = match.participants.map((p) => matchRating(match, p.playerId, mv)?.rating).filter((v) => v !== undefined);
  if (ratings.length === 0) return 0;
  return ratings.reduce((s, v) => s + v, 0) / ratings.length;
}

function computeTeamFormDots(matches, votes, n = 5) {
  // La forma del equipo se basa en notas de partidos oficiales (F8/F9) únicamente.
  matches = onlyOfficialMatches(matches);
  return [...matches]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-n)
    .map((m) => ({ id: m.id, date: m.date, avg: computeMatchAvgRating(m, votes) }));
}

// Jugador del mes: promedio de rendimiento tomando solo los partidos de los últimos `windowDays`
// días contados desde la fecha más reciente cargada. Usa el mismo matchRating de siempre.
function computePlayerOfMonth(players, matches, votes, windowDays = 30) {
  // Jugador del mes = promedio de rendimiento oficial (F8/F9) únicamente.
  matches = onlyOfficialMatches(matches);
  const latest = [...matches].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  if (!latest) return null;
  const cutoff = new Date(latest.date + "T00:00:00");
  cutoff.setDate(cutoff.getDate() - windowDays);
  const recentMatches = matches.filter((m) => new Date(m.date + "T00:00:00") >= cutoff);
  if (recentMatches.length === 0) return null;
  const map = {};
  players.forEach((p) => (map[p.id] = { pj: 0, score: 0 }));
  recentMatches.forEach((m) => {
    const mv = votes[m.id];
    m.participants.forEach((part) => {
      const r = matchRating(m, part.playerId, mv);
      if (r && map[part.playerId]) {
        map[part.playerId].pj += 1;
        map[part.playerId].score += r.rating;
      }
    });
  });
  const ranked = players
    .map((p) => ({ p, pj: map[p.id].pj, avg: map[p.id].pj > 0 ? map[p.id].score / map[p.id].pj : 0 }))
    .filter((x) => x.pj > 0)
    .sort((a, b) => b.avg - a.avg || b.pj - a.pj);
  return ranked[0] || null;
}

// Movimiento en la tabla: compara la posición en el ranking incluyendo todos los partidos
// contra la posición que había ANTES de la última fecha cargada (misma fórmula, menos datos).
function computeRankingMovement(players, matches, votes) {
  // El movimiento en la tabla se basa en el promedio oficial (F8/F9); el pequeño aporte
  // de Ranking de F5/F6 no se tiene en cuenta acá (es solo una referencia de tendencia).
  matches = onlyOfficialMatches(matches);
  const buildOrder = (matchList) => {
    const map = {};
    players.forEach((p) => (map[p.id] = { pj: 0, score: 0 }));
    matchList.forEach((m) => {
      const mv = votes[m.id];
      m.participants.forEach((part) => {
        const r = matchRating(m, part.playerId, mv);
        if (r && map[part.playerId]) {
          map[part.playerId].pj += 1;
          map[part.playerId].score += r.rating;
        }
      });
    });
    return players
      .map((p) => ({ id: p.id, pj: map[p.id].pj, avg: map[p.id].pj > 0 ? map[p.id].score / map[p.id].pj : 0 }))
      .sort((a, b) => b.avg - a.avg || b.pj - a.pj);
  };
  const sortedMatches = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));
  const latestDate = sortedMatches.length ? sortedMatches[sortedMatches.length - 1].date : null;
  const prevMatches = sortedMatches.filter((m) => m.date !== latestDate);
  const currentOrder = buildOrder(matches);
  const prevOrder = buildOrder(prevMatches);
  const movement = {};
  currentOrder.forEach((row, idx) => {
    if (row.pj === 0) { movement[row.id] = null; return; }
    const prevIdx = prevOrder.findIndex((r) => r.id === row.id);
    const prevRow = prevOrder[prevIdx];
    if (!prevRow || prevRow.pj === 0) { movement[row.id] = "nuevo"; return; }
    movement[row.id] = prevIdx - idx; // positivo = subió posiciones, negativo = bajó
  });
  return movement;
}

// ---------- Base preparada para un futuro "Ranking ATP" (puntos acumulados) ----------
// Todavía NO se usa en ninguna pantalla: es solo la estructura de cálculo lista para
// que, el día de mañana, se pueda activar un ranking estilo ATP por puntos sin tocar
// el ranking actual (que sigue ordenando por Promedio oficial + aporte F5/F6).
// Usa únicamente partidos oficiales (F8/F9), igual que el resto de las estadísticas.
const ATP_POINTS = { win: 3, draw: 1, goal: 1, assist: 0.5, mvp: 2 };
function computeAtpPointsBase(players, matches, votes) {
  const map = {};
  players.forEach((p) => (map[p.id] = { points: 0 }));
  onlyOfficialMatches(matches).forEach((m) => {
    const mv = votes[m.id];
    const teamAGoals = teamGoalsFor(m, "A");
    const teamBGoals = teamGoalsFor(m, "B");
    const isDraw = teamAGoals === teamBGoals;
    m.participants.forEach((part) => {
      if (!map[part.playerId]) return;
      const r = matchRating(m, part.playerId, mv);
      if (!r) return;
      let pts = isDraw ? ATP_POINTS.draw : r.win ? ATP_POINTS.win : 0;
      pts += (Number(part.goals) || 0) * ATP_POINTS.goal;
      pts += (Number(part.assists) || 0) * ATP_POINTS.assist;
      if (r.votes > 0) pts += ATP_POINTS.mvp;
      map[part.playerId].points = Math.round((map[part.playerId].points + pts) * 100) / 100;
    });
  });
  return map;
}

// Incorporación reciente: su primer partido cargado cae dentro de la ventana de días desde la última fecha.
function isRecentAddition(playerId, matches, windowDays = 30) {
  const latest = [...matches].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  if (!latest) return false;
  const playerMatches = matches.filter((m) => m.participants.some((p) => p.playerId === playerId));
  if (playerMatches.length === 0) return false;
  const first = [...playerMatches].sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  const cutoff = new Date(latest.date + "T00:00:00");
  cutoff.setDate(cutoff.getDate() - windowDays);
  return new Date(first.date + "T00:00:00") >= cutoff;
}

// Racha goleadora ACTIVA (partidos seguidos anotando hasta hoy, distinto del récord histórico maxGoalStreak).
function computeActiveGoalStreak(playerId, matches) {
  // Racha goleadora = solo partidos oficiales (F8/F9): es un logro/récord.
  matches = onlyOfficialMatches(matches);
  const sorted = [...matches]
    .filter((m) => m.participants.some((p) => p.playerId === playerId))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  let streak = 0;
  for (const m of sorted) {
    const part = m.participants.find((p) => p.playerId === playerId);
    if ((Number(part.goals) || 0) > 0) streak++;
    else break;
  }
  return streak;
}

// Próximo logro más cerca de desbloquear para un jugador (progreso estimado sobre los logros con umbral numérico).
function nextAchievementToUnlock(player, matches, votes) {
  const { list, totalGoals, totalAssists, maxGoalsMatch, cleanSheets } = computeAchievements(player, matches, votes);
  const THRESH = {
    hat: { have: maxGoalsMatch, need: 3 },
    poker: { have: maxGoalsMatch, need: 4 },
    manita: { have: maxGoalsMatch, need: 5 },
    depredador: { have: totalGoals, need: 20 },
    asistHist: { have: totalAssists, need: 10 },
    def: { have: cleanSheets, need: 2 },
  };
  const locked = list.filter((a) => !a.unlocked && !a.comingSoon && THRESH[a.id]);
  if (locked.length === 0) return null;
  const withProgress = locked.map((a) => ({ ...a, ...THRESH[a.id] }));
  withProgress.sort((a, b) => b.have / b.need - a.have / a.need);
  return withProgress[0];
}

// ---------- Logo del club (preparado para reemplazo directo) ----------
// Cuando tengas el archivo del logo, subilo a /public (ej: /public/logo-mercenarios.png)
// y reemplazá CLUB_LOGO_URL por esa ruta ("/logo-mercenarios.png"). Mientras sea null,
// se sigue mostrando el ícono de escudo actual — cero cambios visuales hasta que se cargue el logo.
const CLUB_LOGO_URL = null;

function ClubLogo({ size = 34 }) {
  if (CLUB_LOGO_URL) {
    return (
      <img
        src={CLUB_LOGO_URL}
        alt="Mercenarios FC"
        style={{ width: size, height: size, borderRadius: "9999px", objectFit: "cover" }}
      />
    );
  }
  return <Shield size={Math.round(size * 0.5)} className="text-blue-400" />;
}

// ---------- Avatar de jugador (preparado para foto/imagen personalizada) ----------
// Hoy usa las siluetas por posición. Si en el futuro un jugador tiene `player.avatarUrl`
// cargado, se muestra esa imagen en el mismo círculo sin tocar el resto del componente.
function PlayerAvatar({ player, ring, size = 72 }) {
  if (player?.avatarUrl) {
    return (
      <div className="rounded-full overflow-hidden" style={{ width: size, height: size, border: `2px solid ${ring}` }}>
        <img src={player.avatarUrl} alt={player.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }
  return <PositionAvatar position={player?.position} ring={ring} size={size} />;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [votes, setVotes] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);
  const [tab, setTab] = useState("inicio");
  const [showWho, setShowWho] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [profileId, setProfileId] = useState(null);
  const [voteDraft, setVoteDraft] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editingMatchId, setEditingMatchId] = useState(null);

  useEffect(() => {
    (async () => {
      let loadedPlayers = [];
      try {
        const r = await window.storage.get("players", true);
        loadedPlayers = r ? JSON.parse(r.value) : [];
      } catch (e) {
        loadedPlayers = [];
      }
      const existingNames = new Set(loadedPlayers.map((p) => p.name.trim().toLowerCase()));
      const missingPlayers = SEED_PLAYERS.filter((p) => !existingNames.has(p.name.trim().toLowerCase()));
      if (missingPlayers.length > 0) {
        loadedPlayers = [...loadedPlayers, ...missingPlayers.map((p) => ({ id: "p" + p.number, number: p.number, name: p.name, position: p.position }))];
      }
      // Limpieza única: "Cristian 8" era un jugador placeholder de una seed anterior y
      // ya no debe existir en el sistema (no es el jugador real "Cris 8", que sí se
      // mantiene protegido). Si quedó cargado en Firestore, se elimina automáticamente.
      const beforeCleanup = loadedPlayers.length;
      loadedPlayers = loadedPlayers.filter((p) => normalizedPlayerName(p.name) !== "cristian 8");
      if (missingPlayers.length > 0 || loadedPlayers.length !== beforeCleanup) {
        try {
          await window.storage.set("players", JSON.stringify(loadedPlayers), true);
        } catch (e) {}
      }
      setPlayers(loadedPlayers);
      let loadedMatches = [];
      try {
        const r = await window.storage.get("matches", true);
        loadedMatches = r ? JSON.parse(r.value) : [];
      } catch (e) {
        loadedMatches = [];
      }
      const existingMatchIds = new Set(loadedMatches.map((m) => m.id));
      const missingMatches = SEED_MATCHES.filter((m) => !existingMatchIds.has(m.id));
      let mutated = missingMatches.length > 0;
      if (missingMatches.length > 0) {
        loadedMatches = [...loadedMatches.map((m) => ({ ...m, votingOpen: false })), ...missingMatches];
      }
      // Corrección puntual: Zuko hizo 3 goles, no 2, en el partido del 20/07.
      loadedMatches = loadedMatches.map((m) => {
        if (m.id !== "m20260720") return m;
        const fixedParticipants = m.participants.map((p) => {
          if (p.playerId === "p17" && Number(p.goals) !== 3) {
            mutated = true;
            return { ...p, goals: 3 };
          }
          return p;
        });
        return { ...m, participants: fixedParticipants };
      });
      if (mutated) {
        try {
          await window.storage.set("matches", JSON.stringify(loadedMatches), true);
        } catch (e) {}
      }
      setMatches(loadedMatches);
      try {
        const r = await window.storage.get("votes", true);
        setVotes(r ? JSON.parse(r.value) : {});
      } catch (e) {
        setVotes({});
      }
      try {
        const r = await window.storage.get("currentUserId", false);
        if (r) setCurrentUserId(JSON.parse(r.value));
        else setShowWho(true);
      } catch (e) {
        setShowWho(true);
      }
      try {
        const r = await window.storage.get("adminSession", false);
        if (r && JSON.parse(r.value) === true) setIsAdmin(true);
      } catch (e) {
        // sin sesión de administrador guardada, sigue como visitante
      }
      setLoading(false);
    })();
  }, []);

  async function savePlayers(next) {
    setPlayers(next);
    try {
      await window.storage.set("players", JSON.stringify(next), true);
    } catch (e) {
      setError("No se pudo guardar. Probá de nuevo.");
    }
  }
  async function saveMatches(next) {
    setMatches(next);
    try {
      await window.storage.set("matches", JSON.stringify(next), true);
    } catch (e) {
      setError("No se pudo guardar. Probá de nuevo.");
    }
  }
  async function saveVotes(next) {
    setVotes(next);
    try {
      await window.storage.set("votes", JSON.stringify(next), true);
    } catch (e) {
      setError("No se pudo guardar. Probá de nuevo.");
    }
  }
  async function pickUser(id) {
    setCurrentUserId(id);
    setShowWho(false);
    try {
      await window.storage.set("currentUserId", JSON.stringify(id), false);
    } catch (e) {}
  }

  async function loginAdmin(user, pass) {
    const ok = await verifyAdminCredentials(user, pass);
    if (!ok) {
      setLoginError("Usuario o contraseña incorrectos.");
      return;
    }
    setIsAdmin(true);
    setShowLogin(false);
    setLoginError("");
    try {
      await window.storage.set("adminSession", JSON.stringify(true), false);
    } catch (e) {}
  }

  async function logoutAdmin() {
    setIsAdmin(false);
    try {
      await window.storage.delete("adminSession", false);
    } catch (e) {}
  }

  // Solo F8/F9 generan estadísticas oficiales (ver isOfficialMode). F5/F6 quedan
  // completamente afuera de este cálculo: no suman goles, asistencias, MVP, promedio,
  // récords ni logros. Su único aporte es el Ranking Bonus calculado por separado.
  const officialMatches = useMemo(() => onlyOfficialMatches(matches), [matches]);
  const f56Map = useMemo(() => computeF56Bonus(players, matches), [players, matches]);

  const totals = useMemo(() => {
    const map = {};
    players.forEach((p) => (map[p.id] = { pj: 0, goals: 0, assists: 0, votes: 0, ownGoals: 0, score: 0, goalsW: 0, assistsW: 0 }));
    officialMatches.forEach((m) => {
      const mv = votes[m.id];
      const w = modePointValue(m.mode);
      m.participants.forEach((p) => {
        const r = matchRating(m, p.playerId, mv);
        if (r && map[p.playerId]) {
          map[p.playerId].pj += 1;
          map[p.playerId].goals += r.goals;
          map[p.playerId].assists += r.assists;
          map[p.playerId].votes += r.votes;
          map[p.playerId].ownGoals += r.ownGoals;
          map[p.playerId].score += r.rating;
          map[p.playerId].goalsW += r.goals * w;
          map[p.playerId].assistsW += r.assists * w;
        }
      });
    });
    // Puntos de votos MVP (1 voto = 0,1 pts) y participación ofensiva (goles + asist. ponderados).
    // Presencias y Ranking Bonus de F5/F6 (NO oficiales) se agregan aparte, sin tocar lo anterior.
    Object.keys(map).forEach((id) => {
      const t = map[id];
      t.goalsW = Math.round(t.goalsW * 100) / 100;
      t.assistsW = Math.round(t.assistsW * 100) / 100;
      t.mvpPoints = Math.round(t.votes * MVP_VOTE_POINT * 100) / 100;
      t.offensive = Math.round((t.goalsW + t.assistsW) * 100) / 100;
      const f56 = f56Map[id] || { presencias: 0, bonus: 0 };
      t.presenciasF56 = f56.presencias;
      t.rankingBonus = f56.bonus;
    });
    return map;
  }, [players, officialMatches, f56Map, votes]);

  const ranking = useMemo(
    () =>
      [...players]
        .map((p) => {
          const t = totals[p.id] || { pj: 0, goals: 0, assists: 0, votes: 0, ownGoals: 0, score: 0, presenciasF56: 0, rankingBonus: 0 };
          const avg = t.pj > 0 ? t.score / t.pj : 0;
          // El Ranking general ordena por Promedio oficial (F8/F9) + Ranking Bonus de F5/F6.
          // El Promedio que se muestra como "Nota"/"Carta" sigue siendo SIEMPRE el oficial puro.
          const rankingScore = Math.round((avg + (t.rankingBonus || 0)) * 100) / 100;
          return { ...p, ...t, avg, rankingScore };
        })
        .sort((a, b) => b.rankingScore - a.rankingScore || b.pj - a.pj || b.presenciasF56 - a.presenciasF56),
    [players, totals]
  );

  const currentPlayer = players.find((p) => p.id === currentUserId);
  const activeProfileId = profileId || currentUserId || (players[0] && players[0].id);
  const profilePlayer = players.find((p) => p.id === activeProfileId);

  const profileHistory = useMemo(() => {
    if (!activeProfileId) return [];
    // Evolución de rendimiento = solo partidos oficiales (F8/F9).
    return officialMatches
      .filter((m) => m.participants.some((p) => p.playerId === activeProfileId))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((m) => {
        const r = matchRating(m, activeProfileId, votes[m.id]);
        return { date: m.date, rival: m.teamBName, score: r.rating, mode: m.mode, id: m.id };
      });
  }, [officialMatches, activeProfileId, votes]);

  const statsLeaders = useMemo(() => computeStatsLeaders(players, totals, matches, votes), [players, totals, matches, votes]);
  const idealTeam = useMemo(() => idealTeamAllTime(ranking), [ranking]);
  const playerOfMonth = useMemo(() => computePlayerOfMonth(players, matches, votes), [players, matches, votes]);
  const rankingMovement = useMemo(() => computeRankingMovement(players, matches, votes), [players, matches, votes]);
  const teamFormDots = useMemo(() => computeTeamFormDots(matches, votes, 5), [matches, votes]);
  const seasonTotals = useMemo(() => {
    // Goles históricos = estadística oficial (solo F8/F9).
    const totalGoals = officialMatches.reduce((s, m) => s + m.participants.reduce((s2, p) => s2 + (Number(p.goals) || 0), 0), 0);
    const activePlayers = players.filter((p) => matches.some((m) => m.participants.some((x) => x.playerId === p.id))).length;
    return { totalGoals, activePlayers, totalMatches: matches.length };
  }, [matches, officialMatches, players]);
  const overallAvg = useMemo(() => {
    const withPj = ranking.filter((p) => p.pj > 0);
    if (withPj.length === 0) return 0;
    return withPj.reduce((s, p) => s + p.avg, 0) / withPj.length;
  }, [ranking]);

  async function addPlayer(name, position) {
    if (!isAdmin) return;
    if (players.length >= MAX_PLAYERS) {
      setError("Ya hay 30 jugadores cargados.");
      return;
    }
    const p = { id: "p" + Date.now(), name: name.trim(), position, number: nextNumber(players) };
    await savePlayers([...players, p]);
    setShowAddPlayer(false);
  }

  async function editPlayer(id, name, position) {
    if (!isAdmin) return;
    await savePlayers(players.map((p) => (p.id === id ? { ...p, name: name.trim(), position } : p)));
    setEditingPlayerId(null);
  }

  async function deletePlayer(id) {
    if (!isAdmin) return;
    const target = players.find((p) => p.id === id);
    if (isProtectedPlayer(target)) {
      setError('El jugador "Cris 8" no se puede eliminar.');
      return;
    }
    await savePlayers(players.filter((p) => p.id !== id));
  }

  async function addMatch(form) {
    if (!isAdmin) return;
    const closedPrev = matches.map((m) => ({ ...m, votingOpen: false }));
    const newMatch = { ...form, id: "m" + Date.now(), votingOpen: true };
    await saveMatches([...closedPrev, newMatch]);
    setShowAddMatch(false);
  }

  async function editMatch(id, form) {
    if (!isAdmin) return;
    await saveMatches(matches.map((m) => (m.id === id ? { ...m, ...form } : m)));
    setEditingMatchId(null);
  }

  async function deleteMatch(id) {
    if (!isAdmin) return;
    await saveMatches(matches.filter((m) => m.id !== id));
    const nextVotes = { ...votes };
    delete nextVotes[id];
    await saveVotes(nextVotes);
  }

  async function closeVoting(matchId) {
    if (!isAdmin) return;
    await saveMatches(matches.map((m) => (m.id === matchId ? { ...m, votingOpen: false } : m)));
  }

  async function submitVote(matchId, mvpId) {
    if (!currentUserId) {
      setShowWho(true);
      return;
    }
    const current = votes[matchId] || {};
    if (current[currentUserId]) return;
    const next = { ...votes, [matchId]: { ...current, [currentUserId]: mvpId } };
    await saveVotes(next);
  }

  if (loading) {
    return (
      <div style={{ background: "#0a0c10", minHeight: "100vh" }} className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ border: "2px solid #0D6EFD", boxShadow: "0 0 24px rgba(13,110,253,0.5)" }}
          >
            <Loader2 className="animate-spin" style={{ color: "#0D6EFD" }} size={24} />
          </div>
          <span className="disp text-xs text-gray-500 tracking-widest uppercase">Cargando plantel...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#0a0c10", minHeight: "100vh", fontFamily: "'Rajdhani', system-ui, sans-serif" }} className="text-gray-200 pb-24">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Oswald:wght@500;600;700&family=Bebas+Neue&display=swap');
        .disp { font-family: 'Oswald', system-ui, sans-serif; }
        .bebas { font-family: 'Bebas Neue', 'Oswald', sans-serif; }
        .jersey {
          display:inline-flex; align-items:center; justify-content:center;
          width:34px; height:34px; border-radius:9999px;
          background: linear-gradient(145deg, #171c24, #0a0d12);
          border:1.5px solid #0D6EFD; color:#6fa0ff;
          font-family:'Oswald',sans-serif; font-weight:600; font-size:13px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.08);
        }
        button { transition: transform .15s ease, background-color .15s ease, border-color .15s ease, opacity .15s ease; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 999px; }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 24px rgba(13,110,253,0.5), inset 0 0 12px rgba(13,110,253,0.25); }
          50% { box-shadow: 0 0 40px rgba(13,110,253,0.85), inset 0 0 18px rgba(13,110,253,0.4); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        main > div { animation: fade-in-up .35s ease; }
      `}</style>

      <header
        className="sticky top-0 z-20 border-b border-gray-800"
        style={{ background: "linear-gradient(180deg, #0c0f14f2, #0c0f14e6)", backdropFilter: "blur(10px)" }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(145deg,#12161d,#05070a)", border: "1.5px solid #0D6EFD" }}
            >
              <ClubLogo size={19} />
            </div>
            <div>
              <div className="disp text-base tracking-wide text-white leading-tight">MERCENARIOS <span style={{ color: "#0D6EFD" }}>FC</span></div>
              <div className="text-[10px] text-gray-500 -mt-0.5">Estadísticas del grupo</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowWho(true)}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-700 flex items-center gap-1.5"
              style={{ background: "rgba(255,255,255,0.04)", color: "#6fa0ff" }}
            >
              <Shield size={13} /> {currentPlayer ? currentPlayer.name.split(" ")[0] : "Elegí quién sos"}
            </button>
            <button
              onClick={() => setTab("configuracion")}
              title={isAdmin ? "Sesión de administrador activa" : "Acceso administrador"}
              className="w-8 h-8 rounded-full border flex items-center justify-center shrink-0"
              style={
                isAdmin
                  ? { background: "rgba(13,110,253,0.12)", borderColor: "#0D6EFD" }
                  : { background: "rgba(255,255,255,0.04)", borderColor: "#374151" }
              }
            >
              {isAdmin ? <ShieldCheck size={14} style={{ color: "#0D6EFD" }} /> : <Lock size={13} className="text-gray-500" />}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-3 text-sm bg-red-950/70 border border-red-800 text-red-300 rounded-xl px-3 py-2 flex justify-between">
          {error}
          <button onClick={() => setError("")}><X size={14} /></button>
        </div>
      )}

      <main className="px-4 pt-4 max-w-xl mx-auto">
        {tab === "inicio" && (
          <HomeTab
            players={players}
            matches={matches}
            votes={votes}
            overallAvg={overallAvg}
            season={seasonLabel(matches)}
            ranking={ranking}
            playerOfMonth={playerOfMonth}
            teamFormDots={teamFormDots}
            seasonTotals={seasonTotals}
            currentPlayer={currentPlayer}
            onGoRanking={() => setTab("ranking")}
            onGoPartidos={() => setTab("partidos")}
            onOpenProfile={(id) => { setProfileId(id); setTab("perfil"); }}
          />
        )}
        {tab === "ranking" && (
          <RankingTab
            ranking={ranking}
            leaders={statsLeaders}
            matches={matches}
            votes={votes}
            movement={rankingMovement}
            onOpenProfile={(id) => { setProfileId(id); setTab("perfil"); }}
          />
        )}
        {tab === "partidos" && (
          <PartidosTab
            matches={matches}
            players={players}
            votes={votes}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onAdd={() => setShowAddMatch(true)}
            onVote={submitVote}
            onCloseVoting={closeVoting}
            onEdit={(id) => setEditingMatchId(id)}
            onDelete={(id) => {
              if (window.confirm("¿Borrar este partido? Esta acción no se puede deshacer.")) deleteMatch(id);
            }}
          />
        )}
        {tab === "estadisticas" && (
          <EstadisticasTab
            leaders={statsLeaders}
            idealTeam={idealTeam}
            onOpenProfile={(id) => { setProfileId(id); setTab("perfil"); }}
          />
        )}
        {tab === "jugadores" && (
          <JugadoresTab
            players={players}
            totals={totals}
            matches={matches}
            votes={votes}
            isAdmin={isAdmin}
            onAdd={() => setShowAddPlayer(true)}
            onOpen={(id) => { setProfileId(id); setTab("perfil"); }}
            onEdit={(id) => setEditingPlayerId(id)}
            onDelete={(id) => {
              if (window.confirm("¿Borrar este jugador? Esta acción no se puede deshacer.")) deletePlayer(id);
            }}
          />
        )}
        {tab === "configuracion" && (
          <ConfiguracionTab
            players={players}
            currentPlayer={currentPlayer}
            onChangeUser={() => setShowWho(true)}
            season={seasonLabel(matches)}
            isAdmin={isAdmin}
            onLogin={() => setShowLogin(true)}
            onLogout={logoutAdmin}
          />
        )}
        {tab === "perfil" && (
          <PerfilTab
            players={players}
            profilePlayer={profilePlayer}
            setProfileId={setProfileId}
            totals={totals}
            history={profileHistory}
            onBack={() => setTab("ranking")}
            totalMatches={matches.length}
            matches={matches}
            votes={votes}
          />
        )}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 border-t border-gray-800 grid grid-cols-6 z-20"
        style={{ background: "#0b0d11f5", backdropFilter: "blur(12px)" }}
      >
        {[
          ["inicio", "Inicio", Home],
          ["ranking", "Ranking", Trophy],
          ["partidos", "Partidos", CalendarDays],
          ["estadisticas", "Stats", BarChart3],
          ["jugadores", "Plantel", Users],
          ["configuracion", "Ajustes", Settings],
        ].map(([key, label, Icon]) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex flex-col items-center justify-center py-2.5 gap-0.5 relative"
              style={{ color: active ? "#0D6EFD" : "#6b7280" }}
            >
              {active && <span className="absolute top-0 w-8 h-0.5 rounded-full" style={{ background: "#0D6EFD" }} />}
              <Icon size={18} strokeWidth={active ? 2.4 : 2} />
              <span className="text-[9px] disp tracking-wide">{label}</span>
            </button>
          );
        })}
      </nav>

      {showWho && (
        <Modal onClose={() => currentUserId && setShowWho(false)} title="¿Quién sos?">
          <p className="text-xs text-gray-500 mb-3">Elegí tu nombre para poder votar y ver tu evolución. Se guarda solo en este dispositivo.</p>
          <div className="max-h-72 overflow-y-auto flex flex-col gap-1.5">
            {players.length === 0 && <p className="text-sm text-gray-500">Todavía no hay jugadores cargados.</p>}
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => pickUser(p.id)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl border border-gray-800 hover:border-blue-700/60 text-left transition-colors"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <span className="jersey">{p.number}</span>
                <span className="text-sm text-gray-200">{p.name}</span>
                <span className="text-[10px] text-gray-500 ml-auto">{posLabel(p.position)}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {showLogin && (
        <LoginModal
          onClose={() => { setShowLogin(false); setLoginError(""); }}
          onLogin={loginAdmin}
          error={loginError}
        />
      )}

      {showAddPlayer && isAdmin && (
        <AddPlayerModal onClose={() => setShowAddPlayer(false)} onSave={addPlayer} count={players.length} />
      )}
      {editingPlayerId && isAdmin && (
        <AddPlayerModal
          onClose={() => setEditingPlayerId(null)}
          onSave={(name, position) => editPlayer(editingPlayerId, name, position)}
          count={players.length}
          initial={players.find((p) => p.id === editingPlayerId)}
        />
      )}
      {showAddMatch && isAdmin && (
        <AddMatchModal onClose={() => setShowAddMatch(false)} onSave={addMatch} players={players} />
      )}
      {editingMatchId && isAdmin && (
        <AddMatchModal
          onClose={() => setEditingMatchId(null)}
          onSave={(form) => editMatch(editingMatchId, form)}
          players={players}
          initial={matches.find((m) => m.id === editingMatchId)}
        />
      )}
    </div>
  );
}

function Modal({ onClose, title, children }) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end sm:items-center justify-center px-0 sm:px-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto border border-gray-800"
        style={{ background: "#0d1015", boxShadow: "0 -8px 40px rgba(0,0,0,0.5)" }}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-800 sticky top-0" style={{ background: "#0d1015" }}>
          <h3 className="disp text-white text-base tracking-wide">{title}</h3>
          <button onClick={onClose} className="text-gray-500"><X size={18} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function LoginModal({ onClose, onLogin, error }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!user.trim() || !pass || submitting) return;
    setSubmitting(true);
    await onLogin(user, pass);
    setSubmitting(false);
  }

  return (
    <Modal onClose={onClose} title="Acceso administrador">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-gray-500 leading-snug">
          Solo el administrador puede cargar y editar jugadores, partidos y resultados. El resto del grupo sigue viendo todo sin iniciar sesión.
        </p>
        <div>
          <label className="text-[11px] text-gray-500">Usuario</label>
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="username"
            className="w-full mt-1 bg-gray-900/70 border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-600"
          />
        </div>
        <div>
          <label className="text-[11px] text-gray-500">Contraseña</label>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="current-password"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full mt-1 bg-gray-900/70 border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-600"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          disabled={!user.trim() || !pass || submitting}
          onClick={submit}
          className="mt-1 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-xl py-2.5 text-sm disp tracking-wide flex items-center justify-center gap-2"
          style={user.trim() && pass ? { background: "#0D6EFD" } : {}}
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
          Ingresar
        </button>
      </div>
    </Modal>
  );
}

function HomeTab({
  players, matches, votes, overallAvg, season, ranking, playerOfMonth, teamFormDots, seasonTotals,
  currentPlayer, onGoRanking, onGoPartidos, onOpenProfile,
}) {
  const lastMatch = [...matches].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const lastMatchMvp = useMemo(() => {
    if (!lastMatch) return null;
    const mv = votes[lastMatch.id] || {};
    const counts = {};
    Object.values(mv).forEach((v) => (counts[v] = (counts[v] || 0) + 1));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!top) return null;
    const pl = players.find((p) => p.id === top[0]);
    return pl ? { player: pl, votes: top[1] } : null;
  }, [lastMatch, votes, players]);
  const podium3 = ranking.slice(0, 3);
  const highlight = useMemo(() => {
    if (currentPlayer) {
      const next = nextAchievementToUnlock(currentPlayer, matches, votes);
      if (next) return { kind: "logro", player: currentPlayer, achievement: next };
    }
    // Sin usuario elegido (o sin logros pendientes): destacamos la racha goleadora activa más larga del plantel.
    const streaks = players
      .map((p) => ({ p, streak: computeActiveGoalStreak(p.id, matches) }))
      .filter((x) => x.streak >= 2)
      .sort((a, b) => b.streak - a.streak);
    if (streaks[0]) return { kind: "racha", player: streaks[0].p, streak: streaks[0].streak };
    return null;
  }, [currentPlayer, players, matches, votes]);

  return (
    <div>
      <div
        className="relative rounded-[24px] overflow-hidden mb-5 border border-gray-800"
        style={{ background: "radial-gradient(120% 140% at 50% -10%, rgba(13,110,253,0.35), rgba(11,11,11,0) 60%), linear-gradient(180deg, #10151c 0%, #0b0d11 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-[0.12] pointer-events-none"
          style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 22px, rgba(255,255,255,0.5) 22px, rgba(255,255,255,0.5) 23px)" }}
        />
        <div
          className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,213,79,0.25), transparent 70%)", filter: "blur(10px)" }}
        />
        <div className="relative px-5 pt-8 pb-6 flex flex-col items-center text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-3"
            style={{
              background: "linear-gradient(145deg, #12161d, #05070a)",
              border: "2px solid #0D6EFD",
              animation: "pulse-glow 3s ease-in-out infinite",
            }}
          >
            <ClubLogo size={40} />
          </div>
          <h1 className="disp text-3xl text-white tracking-wide leading-none">MERCENARIOS <span style={{ color: "#0D6EFD" }}>FC</span></h1>
          <span className="mt-2 text-[11px] tracking-[0.2em] text-gray-400 disp uppercase px-3 py-1 rounded-full border border-gray-700 bg-black/30">{season}</span>

          <div className="grid grid-cols-3 gap-2 w-full mt-6">
            {[
              ["Jugadores", players.length],
              ["Partidos", matches.length],
              ["Promedio", overallAvg ? overallAvg.toFixed(1) : "—"],
            ].map(([label, val]) => (
              <div key={label} className="rounded-2xl px-2 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(10px)" }}>
                <div className="disp text-white text-xl">{val}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {seasonTotals && (
            <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><Goal size={11} style={{ color: "#0D6EFD" }} /> {seasonTotals.totalGoals} goles en la temporada</span>
              <span className="flex items-center gap-1"><Users size={11} style={{ color: "#00C853" }} /> {seasonTotals.activePlayers} jugadores activos</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          onClick={onGoRanking}
          className="text-left rounded-2xl p-4 border transition-transform active:scale-95 hover:-translate-y-0.5"
          style={{ background: "linear-gradient(135deg, rgba(13,110,253,0.15), rgba(13,110,253,0.03))", borderColor: "rgba(13,110,253,0.35)" }}
        >
          <Trophy size={20} className="text-blue-400 mb-2" />
          <div className="disp text-white text-sm">Ver ranking</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Tabla individual</div>
        </button>
        <button
          onClick={onGoPartidos}
          className="text-left rounded-2xl p-4 border transition-transform active:scale-95 hover:-translate-y-0.5"
          style={{ background: "linear-gradient(135deg, rgba(0,200,83,0.15), rgba(0,200,83,0.03))", borderColor: "rgba(0,200,83,0.35)" }}
        >
          <CalendarDays size={20} className="text-emerald-400 mb-2" />
          <div className="disp text-white text-sm">Partidos</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Resultados y equipo ideal</div>
        </button>
      </div>

      {playerOfMonth && (
        <button
          onClick={() => onOpenProfile(playerOfMonth.p.id)}
          className="w-full text-left rounded-2xl p-4 mb-5 border flex items-center gap-3 transition-transform active:scale-95 hover:-translate-y-0.5"
          style={{ background: "linear-gradient(135deg, rgba(255,213,79,0.16), rgba(255,213,79,0.02))", borderColor: "#FFD54F55" }}
        >
          <div className="rounded-full p-2.5 shrink-0" style={{ background: "#FFD54F22" }}>
            <Crown size={20} style={{ color: "#FFD54F" }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider">Jugador del mes</div>
            <div className="disp text-white text-sm truncate">{playerOfMonth.p.name}</div>
            <div className="text-[10px] text-gray-500">{playerOfMonth.pj} partidos en los últimos 30 días</div>
          </div>
          <div className="disp text-xl shrink-0" style={{ color: "#FFD54F" }}>{playerOfMonth.avg.toFixed(1)}</div>
        </button>
      )}

      {podium3.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="disp text-sm text-gray-300 tracking-wide uppercase">Top 3 del ranking</h3>
            <button onClick={onGoRanking} className="text-[10px] flex items-center gap-0.5" style={{ color: "#0D6EFD" }}>Ver todo <ChevronRight size={12} /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {podium3.map((p, i) => (
              <button
                key={p.id}
                onClick={() => onOpenProfile(p.id)}
                className="rounded-2xl p-2.5 border flex flex-col items-center text-center transition-transform active:scale-95"
                style={{ background: "rgba(255,255,255,0.03)", borderColor: "#1f2937" }}
              >
                <span className="text-sm">{["🥇", "🥈", "🥉"][i]}</span>
                <span className="jersey mt-1" style={{ width: 28, height: 28, fontSize: 11 }}>{p.number}</span>
                <span className="text-[10px] text-white truncate w-full mt-1 disp">{p.name.split(" ")[0]}</span>
                <span className="disp text-xs font-bold rounded-md px-1.5 mt-1" style={{ color: "#0b0b0b", background: ratingColor(p.avg) }}>{p.pj > 0 ? p.avg.toFixed(1) : "—"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {lastMatch && (
        <div className="mb-5">
          <h3 className="disp text-sm text-gray-300 mb-2 tracking-wide uppercase">Última fecha</h3>
          <div className="rounded-2xl p-4 border border-gray-800" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="flex items-center justify-between text-[11px] text-gray-500 mb-2">
              <span>{new Date(lastMatch.date + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</span>
              <span className="px-2 py-0.5 rounded-full bg-gray-900 border border-gray-800">{lastMatch.mode}</span>
            </div>
            <div className="flex items-center justify-center gap-3 disp text-white text-2xl">
              <span className="text-sm text-gray-300 truncate max-w-[35%]">{lastMatch.teamAName}</span>
              <span style={{ color: "#0D6EFD" }}>{teamGoalsFor(lastMatch, "A")} - {teamGoalsFor(lastMatch, "B")}</span>
              <span className="text-sm text-gray-300 truncate max-w-[35%]">{lastMatch.teamBName}</span>
            </div>
            {lastMatchMvp && (
              <div className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-gray-900 text-xs">
                <Crown size={13} style={{ color: "#FFD54F" }} />
                <span className="text-gray-400">Figura: <span style={{ color: "#FFD54F" }} className="disp">{lastMatchMvp.player.name}</span></span>
              </div>
            )}
          </div>
        </div>
      )}

      {teamFormDots && teamFormDots.length > 1 && (
        <div className="mb-5">
          <h3 className="disp text-sm text-gray-300 mb-2 tracking-wide uppercase">Forma reciente del plantel</h3>
          <div className="rounded-2xl p-4 border border-gray-800 flex items-center justify-between gap-2" style={{ background: "rgba(255,255,255,0.03)" }}>
            {teamFormDots.map((d) => (
              <div key={d.id} className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full h-2 rounded-full" style={{ background: ratingColor(d.avg) }} />
                <span className="text-[8px] text-gray-600">{new Date(d.date + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {highlight && (
        <div>
          <h3 className="disp text-sm text-gray-300 mb-2 tracking-wide uppercase">Dato de la semana</h3>
          {highlight.kind === "logro" ? (
            <button
              onClick={() => onOpenProfile(highlight.player.id)}
              className="w-full text-left rounded-2xl p-4 border flex items-center gap-3 transition-transform active:scale-95"
              style={{ background: "rgba(13,110,253,0.08)", borderColor: "#0D6EFD40" }}
            >
              <div className="rounded-full p-2.5 shrink-0" style={{ background: "#0D6EFD22" }}>
                <highlight.achievement.icon size={18} style={{ color: highlight.achievement.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-400">A un paso de un logro:</div>
                <div className="disp text-white text-sm truncate">{highlight.achievement.label}</div>
                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden mt-1.5">
                  <div className="h-full rounded-full" style={{ width: Math.min(100, (highlight.achievement.have / highlight.achievement.need) * 100) + "%", background: highlight.achievement.color }} />
                </div>
              </div>
              <div className="text-[10px] text-gray-500 shrink-0">{highlight.achievement.have}/{highlight.achievement.need}</div>
            </button>
          ) : (
            <button
              onClick={() => onOpenProfile(highlight.player.id)}
              className="w-full text-left rounded-2xl p-4 border flex items-center gap-3 transition-transform active:scale-95"
              style={{ background: "rgba(239,68,68,0.08)", borderColor: "#EF444440" }}
            >
              <div className="rounded-full p-2.5 shrink-0" style={{ background: "#EF444422" }}>
                <Flame size={18} style={{ color: "#EF4444" }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-400">Racha goleadora activa</div>
                <div className="disp text-white text-sm truncate">{highlight.player.name} lleva {highlight.streak} fechas seguidas anotando</div>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const TIER_STYLE = {
  1: { medal: "🥇", ring: "#FFD54F", grad: "linear-gradient(160deg, rgba(255,213,79,0.28), rgba(255,213,79,0.03))", h: "h-48" },
  2: { medal: "🥈", ring: "#CBD5E1", grad: "linear-gradient(160deg, rgba(226,232,240,0.22), rgba(226,232,240,0.02))", h: "h-40" },
  3: { medal: "🥉", ring: "#D97706", grad: "linear-gradient(160deg, rgba(217,119,6,0.22), rgba(217,119,6,0.02))", h: "h-36" },
};

function PodiumCard({ player, tier, onOpen }) {
  const s = TIER_STYLE[tier];
  const attackPct = Math.min(100, (player.goals || 0) * 12);
  const assistPct = Math.min(100, (player.assists || 0) * 12);
  const isMvp = tier === 1 && player.votes >= 1;
  return (
    <button
      onClick={onOpen}
      className={`relative flex flex-col items-center rounded-2xl px-2 pt-3 pb-2.5 border transition-transform active:scale-95 hover:-translate-y-1 ${s.h}`}
      style={{ background: s.grad, borderColor: s.ring + "55", boxShadow: `0 8px 24px -8px ${s.ring}55` }}
    >
      {isMvp && (
        <span className="absolute -top-2 -right-1 rounded-full p-1" style={{ background: "#0B0B0B", border: `1px solid ${s.ring}` }}>
          <Crown size={11} style={{ color: s.ring }} />
        </span>
      )}
      <span className="text-lg leading-none">{s.medal}</span>
      <span
        className="jersey mt-1.5"
        style={{ width: tier === 1 ? 42 : 34, height: tier === 1 ? 42 : 34, fontSize: tier === 1 ? 15 : 13, borderColor: s.ring, color: s.ring, background: "#0d1117" }}
      >
        {player.number}
      </span>
      <div className="text-[11px] text-white text-center mt-1 truncate w-full disp">{player.name.split(" ")[0]}</div>
      <div className="text-[9px] text-gray-500">{posLabel(player.position)}</div>
      <div className="disp text-sm font-bold mt-1 rounded-md px-1.5" style={{ color: "#0b0b0b", background: s.ring }}>
        {player.pj > 0 ? player.avg.toFixed(1) : "—"}
      </div>
      <div className="text-[8px] text-gray-500 mt-0.5">{player.pj} PJ</div>
      {tier === 1 && (
        <div className="w-full mt-1.5 flex flex-col gap-0.5">
          <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: attackPct + "%", background: "#0D6EFD" }} /></div>
          <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: assistPct + "%", background: "#00C853" }} /></div>
        </div>
      )}
    </button>
  );
}

function MovementBadge({ value }) {
  if (value === null || value === undefined) return <span className="text-[9px] text-gray-700">—</span>;
  if (value === "nuevo") return <span className="text-[8px] text-blue-400 disp uppercase tracking-wide">Nuevo</span>;
  if (value > 0) return <span className="text-[10px] flex items-center gap-0.5" style={{ color: "#00C853" }}><TrendingUp size={11} /> {value}</span>;
  if (value < 0) return <span className="text-[10px] flex items-center gap-0.5" style={{ color: "#EF4444" }}><TrendingDown size={11} /> {Math.abs(value)}</span>;
  return <span className="text-[10px] flex items-center gap-0.5 text-gray-500"><Minus size={11} /></span>;
}

function FormDots({ form, size = 6 }) {
  if (!form || form.length === 0) return <span className="text-[9px] text-gray-700">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {form.map((f, i) => (
        <span key={f.id || i} className="rounded-full" style={{ width: size, height: size, background: ratingColor(f.rating) }} title={f.rating.toFixed(1)} />
      ))}
    </div>
  );
}

const RANKING_QUICK_TABS = [
  ["general", "General"],
  ["goleadores", "Goleadores"],
  ["asistidores", "Asistidores"],
  ["vallas", "Vallas invictas"],
];

function RankingTab({ ranking, leaders, matches, votes, movement, onOpenProfile }) {
  const [quickTab, setQuickTab] = useState("general");
  const [posFilter, setPosFilter] = useState("ALL");

  const filtered = useMemo(
    () => (posFilter === "ALL" ? ranking : ranking.filter((p) => p.position === posFilter)),
    [ranking, posFilter]
  );

  const sortedList = useMemo(() => {
    const withPj = filtered.filter((p) => p.pj > 0);
    if (quickTab === "goleadores") return [...withPj].sort((a, b) => b.goals - a.goals);
    if (quickTab === "asistidores") return [...withPj].sort((a, b) => b.assists - a.assists);
    if (quickTab === "vallas")
      return [...withPj]
        .filter((p) => p.position === "ARQ" || p.position === "DEF")
        .sort((a, b) => (leaders.cleanSheetsMap[b.id] || 0) - (leaders.cleanSheetsMap[a.id] || 0));
    return filtered; // general: ya viene ordenado por promedio
  }, [filtered, quickTab, leaders]);

  const podium = quickTab === "general" && posFilter === "ALL" ? ranking.slice(0, 3) : [];
  const rest = quickTab === "general" ? filtered.slice(posFilter === "ALL" ? 3 : 0) : sortedList;

  const valueFor = (p) => {
    if (quickTab === "goleadores") return p.goals;
    if (quickTab === "asistidores") return p.assists;
    if (quickTab === "vallas") return leaders.cleanSheetsMap[p.id] || 0;
    return p.pj > 0 ? p.avg.toFixed(1) : "—";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="disp text-white text-2xl tracking-wide">Tabla individual</h2>
        <Trophy size={20} style={{ color: "#FFD54F" }} />
      </div>
      <p className="text-[11px] text-gray-500 mb-3 leading-snug">
        Nota por partido (2 a 10): arranca en 6 y suma/resta por gol (+1), asistencia (+0.6), valla invicta (+0.5, arq/def), ganar (+0.5), voto figura (+0.5 c/u, máx 3), reconocimientos (+0.5 c/u), gol en contra (−1). Solo cuenta partidos <b>F8/F9</b>. El ranking ordena por <span style={{ color: "#0D6EFD" }}>promedio oficial</span> + un pequeño aporte de presencia en <b>F5/F6</b> (hasta +0,3 por partido, no altera goles/asistencias/promedio).
      </p>

      <div className="flex gap-1.5 mb-2 overflow-x-auto">
        {RANKING_QUICK_TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setQuickTab(key)}
            className="text-xs px-3 py-1.5 rounded-full border shrink-0 disp"
            style={quickTab === key ? { background: "#0D6EFD", borderColor: "#0D6EFD", color: "#fff" } : { background: "rgba(255,255,255,0.03)", borderColor: "#1f2937", color: "#9ca3af" }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 mb-4 overflow-x-auto">
        {[["ALL", "Todas"], ...POSITIONS.map((p) => [p.id, p.label])].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPosFilter(key)}
            className="text-[11px] px-2.5 py-1 rounded-full border shrink-0"
            style={posFilter === key ? { background: "rgba(13,110,253,0.18)", borderColor: "#0D6EFD", color: "#6fa0ff" } : { background: "transparent", borderColor: "#1f2937", color: "#6b7280" }}
          >
            {label}
          </button>
        ))}
      </div>

      {podium.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-5 items-end">
          {[podium[1], podium[0], podium[2]].map((p, idx) =>
            p ? (
              <PodiumCard key={p.id} player={p} tier={idx === 1 ? 1 : idx === 0 ? 2 : 3} onOpen={() => onOpenProfile(p.id)} />
            ) : (
              <div key={idx} />
            )
          )}
        </div>
      )}

      <div className="rounded-2xl border border-gray-800 overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="grid grid-cols-12 text-[10px] text-gray-500 px-3 py-2 bg-gray-900/70 disp tracking-wider uppercase">
          <div className="col-span-1">#</div>
          <div className="col-span-4">Jugador</div>
          <div className="col-span-2 text-center">Forma</div>
          <div className="col-span-2 text-center">Mov.</div>
          <div className="col-span-3 text-right">{quickTab === "general" ? "Nota" : quickTab === "vallas" ? "Vallas" : quickTab === "goleadores" ? "Goles" : "Asist."}</div>
        </div>
        {rest.length === 0 && <div className="p-4 text-sm text-gray-500">No hay jugadores para este filtro todavía.</div>}
        {rest.map((p, i) => (
          <button
            key={p.id}
            onClick={() => onOpenProfile(p.id)}
            className="w-full grid grid-cols-12 items-center px-3 py-2.5 border-t border-gray-900 hover:bg-white/[0.03] text-left transition-colors"
          >
            <div className="col-span-1 disp font-semibold text-gray-500">{quickTab === "general" && posFilter === "ALL" ? i + 4 : i + 1}</div>
            <div className="col-span-4 flex items-center gap-2 min-w-0">
              <span className="jersey" style={{ width: 28, height: 28, fontSize: 11 }}>{p.number}</span>
              <span className="text-sm text-gray-200 truncate">{p.name}</span>
              {quickTab === "general" && p.rankingBonus > 0 && (
                <span
                  className="text-[8px] shrink-0 px-1 py-0.5 rounded-full disp"
                  style={{ background: "#00C85322", color: "#00C853" }}
                  title="Aporte de Ranking por presencia en F5/F6 (no es promedio oficial)"
                >
                  +{p.rankingBonus.toFixed(1)} F5/F6
                </span>
              )}
            </div>
            <div className="col-span-2 flex justify-center">
              <FormDots form={computeRecentForm(p.id, matches, votes, 4)} />
            </div>
            <div className="col-span-2 flex justify-center">
              <MovementBadge value={movement ? movement[p.id] : null} />
            </div>
            <div className="col-span-3 flex justify-end">
              <span className="disp text-xs font-bold rounded-md px-1.5 py-0.5" style={{ color: "#0b0b0b", background: quickTab === "general" ? ratingColor(p.avg) : "#0D6EFD" }}>
                {valueFor(p)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const PLAYER_SORTS = [
  ["nota", "Nota"],
  ["pj", "Partidos"],
  ["nombre", "Nombre"],
];
const LINE_GROUPS = [
  ["ARQ", "Arqueros"],
  ["DEF", "Defensores"],
  ["MED", "Mediocampistas"],
  ["DEL", "Delanteros"],
];

function PlayerListCard({ p, t, avg, tier, trend, isNew, streak, isAdmin, onOpen, onEdit, onDelete }) {
  const meta = CARD_TIERS[tier];
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-3 py-2.5 border border-gray-800 hover:border-blue-700/60 transition-colors"
      style={{ background: "rgba(255,255,255,0.02)" }}
    >
      <button onClick={onOpen} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <span className="jersey shrink-0">{p.number}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm text-gray-200 truncate">{p.name}</span>
            {isNew && <span className="text-[8px] shrink-0 px-1.5 py-0.5 rounded-full disp uppercase tracking-wide" style={{ background: "#00C85322", color: "#00C853" }}>Nuevo</span>}
            {streak >= 2 && <span className="text-[8px] shrink-0 px-1.5 py-0.5 rounded-full disp uppercase tracking-wide flex items-center gap-0.5" style={{ background: "#EF444422", color: "#EF4444" }}><Flame size={9} /> Racha</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-gray-500">{posLabel(p.position)}</span>
            {t?.pj > 0 && (
              <span className="text-[9px] px-1.5 rounded-full disp" style={{ color: meta.ring, background: meta.ring + "18" }}>{meta.emoji} {meta.label}</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="disp text-sm font-bold rounded-md px-1.5" style={{ color: t?.pj ? "#0b0b0b" : "#6b7280", background: t?.pj ? ratingColor(avg) : "transparent" }}>
            {t?.pj ? avg.toFixed(1) : "—"}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">{t?.pj ?? 0} PJ · {t?.goals ?? 0}G {t?.assists ?? 0}A</div>
          {t?.pj > 0 && trend.status !== "sin-datos" && (
            <div className="text-[9px] mt-0.5" style={{ color: TREND_META[trend.status].color }}>{TREND_META[trend.status].emoji} {TREND_META[trend.status].label}</div>
          )}
        </div>
      </button>
      {isAdmin ? (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 text-gray-500 hover:text-blue-400"><Pencil size={14} /></button>
          {isProtectedPlayer(p) ? (
            <span className="p-1.5 text-gray-700" title='"Cris 8" no se puede eliminar'><Lock size={14} /></span>
          ) : (
            <button onClick={onDelete} className="p-1.5 text-gray-500 hover:text-red-400"><Trash2 size={14} /></button>
          )}
        </div>
      ) : (
        <ChevronRight size={16} className="text-gray-600 shrink-0" />
      )}
    </div>
  );
}

function JugadoresTab({ players, totals, matches, votes, isAdmin, onAdd, onOpen, onEdit, onDelete }) {
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("nota");

  const mvpLeaderId = useMemo(
    () => [...players].map((p) => ({ id: p.id, votes: (totals[p.id] || {}).votes || 0 })).sort((a, b) => b.votes - a.votes)[0]?.id,
    [players, totals]
  );

  const enriched = useMemo(() => {
    return players.map((p) => {
      const t = totals[p.id];
      const avg = t?.pj ? t.score / t.pj : 0;
      return {
        p, t, avg,
        tier: tierFromAvg(avg, t?.pj || 0, p.id === mvpLeaderId),
        trend: computeTrend(p, matches, votes),
        isNew: isRecentAddition(p.id, matches),
        streak: computeActiveGoalStreak(p.id, matches),
      };
    });
  }, [players, totals, matches, votes, mvpLeaderId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((x) => (posFilter === "ALL" || x.p.position === posFilter) && (!q || x.p.name.toLowerCase().includes(q)));
  }, [enriched, search, posFilter]);

  const sorter = (a, b) => {
    if (sortBy === "pj") return (b.t?.pj || 0) - (a.t?.pj || 0);
    if (sortBy === "nombre") return a.p.name.localeCompare(b.p.name, "es");
    return b.avg - a.avg || (b.t?.pj || 0) - (a.t?.pj || 0);
  };

  const groups = posFilter === "ALL"
    ? LINE_GROUPS.map(([id, label]) => [id, label, filtered.filter((x) => x.p.position === id).sort(sorter)])
    : [[posFilter, posLabel(posFilter), [...filtered].sort(sorter)]];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="disp text-white text-2xl tracking-wide">Jugadores <span className="text-gray-500 text-base">({players.length}/{MAX_PLAYERS})</span></h2>
        {isAdmin && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1 text-xs text-white px-3 py-1.5 rounded-full transition-transform active:scale-95"
            style={{ background: "#0D6EFD" }}
          >
            <Plus size={14} /> Sumar
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2.5">
        <div className="flex-1 flex items-center gap-2 rounded-xl border border-gray-800 px-3 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
          <Users size={14} className="text-gray-600 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar jugador..."
            className="bg-transparent text-sm text-gray-200 outline-none w-full placeholder:text-gray-600"
          />
          {search && <button onClick={() => setSearch("")}><X size={13} className="text-gray-600" /></button>}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="text-xs bg-gray-900/70 border border-gray-800 rounded-xl px-2 py-2 text-gray-300 shrink-0"
        >
          {PLAYER_SORTS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      <div className="flex gap-1.5 mb-4 overflow-x-auto">
        {[["ALL", "Todas"], ...POSITIONS.map((p) => [p.id, p.label])].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPosFilter(key)}
            className="text-[11px] px-2.5 py-1 rounded-full border shrink-0"
            style={posFilter === key ? { background: "rgba(13,110,253,0.18)", borderColor: "#0D6EFD", color: "#6fa0ff" } : { background: "transparent", borderColor: "#1f2937", color: "#6b7280" }}
          >
            {label}
          </button>
        ))}
      </div>

      {players.length === 0 && <p className="text-sm text-gray-500">Todavía no hay jugadores cargados.</p>}
      {players.length > 0 && filtered.length === 0 && <p className="text-sm text-gray-500">No encontramos jugadores con ese filtro.</p>}

      {groups.map(([id, label, list]) =>
        list.length === 0 ? null : (
          <div key={id} className="mb-4">
            {posFilter === "ALL" && (
              <h3 className="disp text-[11px] text-gray-500 mb-2 tracking-widest uppercase">{label} <span className="text-gray-700">({list.length})</span></h3>
            )}
            <div className="grid grid-cols-1 gap-2">
              {list.map((x) => (
                <PlayerListCard
                  key={x.p.id}
                  p={x.p} t={x.t} avg={x.avg} tier={x.tier} trend={x.trend} isNew={x.isNew} streak={x.streak}
                  isAdmin={isAdmin}
                  onOpen={() => onOpen(x.p.id)}
                  onEdit={() => onEdit(x.p.id)}
                  onDelete={() => onDelete(x.p.id)}
                />
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}

function AddPlayerModal({ onClose, onSave, count, initial }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name || "");
  const [position, setPosition] = useState(initial?.position || "MED");
  return (
    <Modal onClose={onClose} title={isEdit ? "Editar jugador" : "Sumar jugador"}>
      {!isEdit && count >= MAX_PLAYERS ? (
        <p className="text-sm text-red-400">Ya están los 30 jugadores cargados.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[11px] text-gray-500">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Franco Díaz"
              className="w-full mt-1 bg-gray-900/70 border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-600"
            />
          </div>
          <div>
            <label className="text-[11px] text-gray-500">Posición</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {POSITIONS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPosition(p.id)}
                  className="text-xs py-2 rounded-xl border"
                  style={position === p.id ? { background: "#0D6EFD", borderColor: "#0D6EFD", color: "#fff" } : { background: "rgba(255,255,255,0.03)", borderColor: "#1f2937", color: "#9ca3af" }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <button
            disabled={!name.trim()}
            onClick={() => onSave(name, position)}
            className="mt-1 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-xl py-2.5 text-sm disp tracking-wide"
            style={name.trim() ? { background: "#0D6EFD" } : {}}
          >
            {isEdit ? "Guardar cambios" : "Guardar jugador"}
          </button>
        </div>
      )}
    </Modal>
  );
}

function AddMatchModal({ onClose, onSave, players, initial }) {
  const isEdit = !!initial;
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState(initial?.mode || MODES[0]);
  const [teamAName, setTeamAName] = useState(initial?.teamAName || "Equipo A");
  const [teamBName, setTeamBName] = useState(initial?.teamBName || "Equipo B");
  const [rows, setRows] = useState(initial?.participants || []);
  const [awards, setAwards] = useState(initial?.awards || []);
  const [awardLabel, setAwardLabel] = useState("");
  const [awardPlayers, setAwardPlayers] = useState([]);

  function toggleAwardPlayer(id) {
    setAwardPlayers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function addAward() {
    if (!awardLabel.trim() || awardPlayers.length === 0) return;
    setAwards([...awards, ...awardPlayers.map((pid) => ({ label: awardLabel.trim(), playerId: pid }))]);
    setAwardLabel("");
    setAwardPlayers([]);
  }
  function removeAward(i) {
    setAwards(awards.filter((_, idx) => idx !== i));
  }

  function addRow() {
    const avail = players.find((p) => !rows.some((r) => r.playerId === p.id));
    if (!avail) return;
    setRows([...rows, { playerId: avail.id, position: avail.position, team: "A", goals: 0, assists: 0, ownGoals: 0 }]);
  }
  function updateRow(i, patch) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRow(i) {
    setRows(rows.filter((_, idx) => idx !== i));
  }

  return (
    <Modal onClose={onClose} title={isEdit ? "Editar partido" : "Cargar partido"}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-gray-500">Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 bg-gray-900/70 border border-gray-800 rounded-xl px-2 py-2 text-sm text-gray-200" />
          </div>
          <div>
            <label className="text-[11px] text-gray-500">Modalidad</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full mt-1 bg-gray-900/70 border border-gray-800 rounded-xl px-2 py-2 text-sm text-gray-200">
              {MODES.map((m) => <option key={m}>{m}</option>)}
            </select>
            <p className="text-[9px] text-gray-600 mt-1">F9/F8 = estadísticas oficiales (goles, asist., MVP, promedio, logros). F6/F5 = no suman estadísticas oficiales, solo dan hasta +0,3 de Ranking por presencia/triunfo/goleador.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={teamAName} onChange={(e) => setTeamAName(e.target.value)} className="bg-gray-900/70 border border-gray-800 rounded-xl px-2 py-2 text-sm text-gray-200" />
          <input value={teamBName} onChange={(e) => setTeamBName(e.target.value)} className="bg-gray-900/70 border border-gray-800 rounded-xl px-2 py-2 text-sm text-gray-200" />
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className="text-[11px] text-gray-500">Jugadores del partido</span>
          <button onClick={addRow} className="text-xs flex items-center gap-1" style={{ color: "#0D6EFD" }}><Plus size={13} /> Agregar</button>
        </div>

        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {rows.map((r, i) => {
            const player = players.find((p) => p.id === r.playerId);
            return (
              <div key={i} className="bg-gray-900/60 border border-gray-800 rounded-xl p-2 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <select
                    value={r.playerId}
                    onChange={(e) => {
                      const pl = players.find((p) => p.id === e.target.value);
                      updateRow(i, { playerId: e.target.value, position: pl?.position });
                    }}
                    className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-2 py-1 text-xs text-gray-200"
                  >
                    {players.map((p) => (
                      <option key={p.id} value={p.id} disabled={rows.some((rr, ii) => ii !== i && rr.playerId === p.id)}>
                        #{p.number} {p.name}
                      </option>
                    ))}
                  </select>
                  <select value={r.team} onChange={(e) => updateRow(i, { team: e.target.value })} className="bg-gray-950 border border-gray-800 rounded-lg px-2 py-1 text-xs text-gray-200">
                    <option value="A">{teamAName}</option>
                    <option value="B">{teamBName}</option>
                  </select>
                  <button onClick={() => removeRow(i)} className="text-gray-600"><X size={14} /></button>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-gray-500">
                  Jugó de:
                  <select value={r.position} onChange={(e) => updateRow(i, { position: e.target.value })} className="bg-gray-950 border border-gray-800 rounded-lg px-1 py-0.5 text-gray-200">
                    {POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  <label className="flex items-center gap-1">Goles
                    <input type="number" min="0" value={r.goals} onChange={(e) => updateRow(i, { goals: e.target.value })} className="w-12 bg-gray-950 border border-gray-800 rounded-lg px-1 py-0.5 text-gray-200" />
                  </label>
                  <label className="flex items-center gap-1">Asist.
                    <input type="number" min="0" value={r.assists} onChange={(e) => updateRow(i, { assists: e.target.value })} className="w-12 bg-gray-950 border border-gray-800 rounded-lg px-1 py-0.5 text-gray-200" />
                  </label>
                  <label className="flex items-center gap-1 text-orange-400">En contra
                    <input type="number" min="0" value={r.ownGoals || 0} onChange={(e) => updateRow(i, { ownGoals: e.target.value })} className="w-12 bg-gray-950 border border-gray-800 rounded-lg px-1 py-0.5 text-gray-200" />
                  </label>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && <p className="text-xs text-gray-600">Agregá jugadores que participaron.</p>}
        </div>

        <div className="border-t border-gray-900 pt-3">
          <span className="text-[11px] text-gray-500">Reconocimientos del partido</span>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {QUICK_AWARDS.map((q) => (
              <button
                key={q}
                onClick={() => setAwardLabel(q)}
                className="text-[10px] px-2 py-1 rounded-full border"
                style={awardLabel === q ? { background: "#0D6EFD", borderColor: "#0D6EFD", color: "#fff" } : { background: "rgba(255,255,255,0.03)", borderColor: "#1f2937", color: "#9ca3af" }}
              >
                {q}
              </button>
            ))}
          </div>
          <input
            value={awardLabel}
            onChange={(e) => setAwardLabel(e.target.value)}
            placeholder="O escribí tu propia categoría"
            className="w-full mt-2 bg-gray-900/70 border border-gray-800 rounded-xl px-2 py-1.5 text-xs text-gray-200"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {rows.map((r) => {
              const pl = players.find((p) => p.id === r.playerId);
              if (!pl) return null;
              const sel = awardPlayers.includes(pl.id);
              return (
                <button
                  key={pl.id}
                  onClick={() => toggleAwardPlayer(pl.id)}
                  className="text-[10px] px-2 py-1 rounded-full border"
                  style={sel ? { background: "#0D6EFD", borderColor: "#0D6EFD", color: "#fff" } : { background: "rgba(255,255,255,0.03)", borderColor: "#1f2937", color: "#9ca3af" }}
                >
                  {pl.name}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-600 mt-1">Elegí uno o más jugadores (para duplas, elegí a los dos).</p>
          <button onClick={addAward} className="mt-2 text-xs flex items-center gap-1" style={{ color: "#0D6EFD" }}><Plus size={13} /> Agregar reconocimiento</button>

          <div className="flex flex-col gap-1 mt-2">
            {awards.map((a, i) => {
              const pl = players.find((p) => p.id === a.playerId);
              return (
                <div key={i} className="flex items-center justify-between text-xs bg-gray-900/60 border border-gray-800 rounded-lg px-2 py-1.5">
                  <span className="text-gray-300">{a.label} · <span style={{ color: "#0D6EFD" }}>{pl?.name}</span></span>
                  <button onClick={() => removeAward(i)} className="text-gray-600"><X size={13} /></button>
                </div>
              );
            })}
          </div>
        </div>

        <button
          disabled={rows.length === 0}
          onClick={() => onSave({ date, mode, teamAName, teamBName, participants: rows, awards })}
          className="mt-1 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-xl py-2.5 text-sm disp tracking-wide"
          style={rows.length > 0 ? { background: "#0D6EFD" } : {}}
        >
          {isEdit ? "Guardar cambios" : "Guardar partido"}
        </button>
      </div>
    </Modal>
  );
}

function PartidosTab({ matches, players, votes, currentUserId, isAdmin, onAdd, onVote, onCloseVoting, onEdit, onDelete }) {
  const sorted = [...matches].sort((a, b) => new Date(b.date) - new Date(a.date));
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="disp text-white text-2xl tracking-wide">Partidos</h2>
        {isAdmin && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1 text-xs text-white px-3 py-1.5 rounded-full transition-transform active:scale-95"
            style={{ background: "#0D6EFD" }}
          >
            <Plus size={14} /> Cargar
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {sorted.length === 0 && <p className="text-sm text-gray-500">Todavía no hay partidos cargados.</p>}
        {sorted.map((m) => (
          <MatchCard
            key={m.id}
            m={m}
            players={players}
            votes={votes}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onVote={onVote}
            onCloseVoting={onCloseVoting}
            onEdit={() => onEdit(m.id)}
            onDelete={() => onDelete(m.id)}
          />
        ))}
      </div>
    </div>
  );
}

function MatchCard({ m, players, votes, currentUserId, isAdmin, onVote, onCloseVoting, onEdit, onDelete }) {
  const [showTeam, setShowTeam] = useState(false);
  const teamAGoals = teamGoalsFor(m, "A");
  const teamBGoals = teamGoalsFor(m, "B");
  const myVote = votes[m.id]?.[currentUserId];
  const voteCounts = {};
  Object.values(votes[m.id] || {}).forEach((v) => (voteCounts[v] = (voteCounts[v] || 0) + 1));
  const mvpEntries = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
  const team = useMemo(() => buildTeamOfMatch(m, players, votes), [m, players, votes]);
  const mvpPlayer = mvpEntries[0] ? players.find((p) => p.id === mvpEntries[0][0]) : null;

  const scorers = m.participants
    .filter((p) => (Number(p.goals) || 0) > 0)
    .map((p) => ({ ...p, pl: players.find((x) => x.id === p.playerId) }))
    .sort((a, b) => b.goals - a.goals);
  const assisters = m.participants
    .filter((p) => (Number(p.assists) || 0) > 0)
    .map((p) => ({ ...p, pl: players.find((x) => x.id === p.playerId) }));
  const carded = m.participants
    .filter((p) => p.yellow || p.red)
    .map((p) => ({ ...p, pl: players.find((x) => x.id === p.playerId) }));

  return (
    <div className="rounded-2xl border border-gray-800 overflow-hidden" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))" }}>
      <div className="px-4 pt-3 pb-4" style={{ background: "radial-gradient(120% 100% at 50% 0%, rgba(13,110,253,0.14), transparent 65%)" }}>
        <div className="flex items-center justify-between text-[10px] text-gray-500 mb-3">
          <span>{new Date(m.date + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</span>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-gray-900/80 border border-gray-800 disp tracking-wide">{m.mode}</span>
            {isAdmin && (
              <div className="flex items-center gap-1.5">
                <button onClick={onEdit} className="text-gray-500 hover:text-blue-400"><Pencil size={13} /></button>
                <button onClick={onDelete} className="text-gray-500 hover:text-red-400"><Trash2 size={13} /></button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center disp text-xs" style={{ background: "linear-gradient(145deg,#12161d,#05070a)", border: "1.5px solid #0D6EFD", color: "#6fa0ff" }}>
              {initials(m.teamAName)}
            </div>
            <span className="text-[11px] text-gray-300 truncate max-w-full">{m.teamAName}</span>
          </div>
          <div className="disp text-white flex items-center gap-2 px-2 bebas" style={{ fontSize: 40, lineHeight: 1 }}>
            <span>{teamAGoals}</span>
            <span className="text-gray-600 text-2xl">-</span>
            <span>{teamBGoals}</span>
          </div>
          <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center disp text-xs" style={{ background: "linear-gradient(145deg,#12161d,#05070a)", border: "1.5px solid #00C853", color: "#4ade80" }}>
              {initials(m.teamBName)}
            </div>
            <span className="text-[11px] text-gray-300 truncate max-w-full">{m.teamBName}</span>
          </div>
        </div>
        <div className="text-center text-[10px] text-gray-600 mt-2">{m.participants.length} jugadores registrados</div>
      </div>

      <div className="px-4 pb-4">
        {mvpPlayer && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-2.5 border" style={{ borderColor: "#FFD54F55", background: "#FFD54F14" }}>
            <Crown size={14} style={{ color: "#FFD54F" }} />
            <span className="text-xs text-gray-300">Figura del partido: <span className="disp" style={{ color: "#FFD54F" }}>{mvpPlayer.name}</span></span>
          </div>
        )}

        {(scorers.length > 0 || assisters.length > 0 || carded.length > 0) && (
          <div className="flex flex-col gap-1.5 mb-2.5">
            {scorers.length > 0 && (
              <div className="flex items-start gap-2 text-[11px]">
                <Goal size={13} style={{ color: "#0D6EFD" }} className="mt-0.5 shrink-0" />
                <span className="text-gray-400 flex-1">{scorers.map((s) => `${s.pl?.name}${s.goals > 1 ? ` (${s.goals})` : ""}`).join(", ")}</span>
              </div>
            )}
            {assisters.length > 0 && (
              <div className="flex items-start gap-2 text-[11px]">
                <Target size={13} style={{ color: "#00C853" }} className="mt-0.5 shrink-0" />
                <span className="text-gray-400 flex-1">{assisters.map((s) => `${s.pl?.name}${s.assists > 1 ? ` (${s.assists})` : ""}`).join(", ")}</span>
              </div>
            )}
            {carded.length > 0 && (
              <div className="flex items-start gap-2 text-[11px]">
                <span className="mt-0.5 shrink-0 w-2.5 h-3.5 rounded-[2px]" style={{ background: "#FFD54F" }} />
                <span className="text-gray-400 flex-1">{carded.map((c) => c.pl?.name).join(", ")}</span>
              </div>
            )}
          </div>
        )}

        {m.awards && m.awards.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {m.awards.map((a, i) => {
              const pl = players.find((p) => p.id === a.playerId);
              return (
                <span key={i} className="text-[10px] bg-gray-900/70 border border-gray-800 text-gray-400 rounded-full px-2 py-0.5">
                  {a.label}: <span style={{ color: "#0D6EFD" }}>{pl?.name}</span>
                </span>
              );
            })}
          </div>
        )}

        <div className="border-t border-gray-900 pt-2.5">
          {m.votingOpen ? (
            myVote ? (
              <div className="flex items-center gap-1 text-xs" style={{ color: "#00C853" }}><Check size={13} /> Ya votaste tu figura de este partido</div>
            ) : (
              <VoteRow match={m} players={players} onVote={(mvpId) => onVote(m.id, mvpId)} />
            )
          ) : (
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <Lock size={12} /> Votación cerrada
              {mvpEntries[0] && (
                <span className="ml-1" style={{ color: "#0D6EFD" }}>
                  · Figura: {mvpPlayer?.name || "—"} ({mvpEntries[0][1]} votos)
                </span>
              )}
            </div>
          )}
          {m.votingOpen && isAdmin && (
            <button onClick={() => onCloseVoting(m.id)} className="text-[10px] text-gray-600 mt-1.5 underline">Cerrar votación ahora</button>
          )}
        </div>

        <div className="border-t border-gray-900 pt-2.5 mt-2.5">
          <button onClick={() => setShowTeam((v) => !v)} className="text-xs flex items-center gap-1 disp tracking-wide" style={{ color: "#0D6EFD" }}>
            <Shirt size={13} /> Equipo de la Fecha ({formationLabel(m.mode)}) {showTeam ? "▲" : "▼"}
          </button>
          {showTeam && <TeamOfMatch team={team} />}
        </div>
      </div>
    </div>
  );
}

function TeamOfMatch({ team }) {
  const lines = [
    ["Delanteros", team.DEL],
    ["Mediocampistas", team.MED],
    ["Defensores", team.DEF],
    ["Arquero", team.ARQ],
  ];
  return (
    <div className="mt-2.5 rounded-2xl border border-gray-800 p-3" style={{ background: "linear-gradient(180deg,#0d1420,#0a0d13)" }}>
      {lines.map(([label, arr]) => (
        <div key={label} className="mb-3 last:mb-0">
          <div className="text-[9px] text-gray-600 text-center mb-1.5 tracking-widest disp uppercase">{label}</div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {(!arr || arr.length === 0) && <span className="text-[10px] text-gray-700">—</span>}
            {arr && arr.map((pl) => (
              <div key={pl.playerId} className="flex flex-col items-center w-16">
                <span className="jersey" style={{ width: 32, height: 32, fontSize: 12 }}>{pl.number}</span>
                <span className="text-[9px] text-gray-300 truncate w-full text-center mt-0.5">{pl.name}</span>
                <span className="text-[9px] disp" style={{ color: ratingColor(pl.rating) }}>{pl.rating.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function VoteRow({ match, players, onVote }) {
  const [sel, setSel] = useState("");
  const options = match.participants.map((p) => players.find((pl) => pl.id === p.playerId)).filter(Boolean);
  return (
    <div className="flex items-center gap-2">
      <select value={sel} onChange={(e) => setSel(e.target.value)} className="flex-1 bg-gray-900/70 border border-gray-800 rounded-xl px-2 py-1.5 text-xs text-gray-200">
        <option value="">Elegí la figura del partido</option>
        {options.map((p) => <option key={p.id} value={p.id}>#{p.number} {p.name}</option>)}
      </select>
      <button
        disabled={!sel}
        onClick={() => onVote(sel)}
        className="text-xs disabled:bg-gray-800 disabled:text-gray-600 text-white px-3 py-1.5 rounded-xl flex items-center gap-1"
        style={sel ? { background: "#0D6EFD" } : {}}
      >
        <Vote size={12} /> Votar
      </button>
    </div>
  );
}

function StatLeaderCard({ icon: Icon, label, entry, value, suffix, accent, onOpen }) {
  if (!entry) {
    return (
      <div className="rounded-2xl border border-gray-800 p-3 flex items-center gap-3 opacity-40" style={{ background: "rgba(255,255,255,0.02)" }}>
        <Icon size={16} className="text-gray-600" />
        <div className="text-[11px] text-gray-600">{label}: sin datos</div>
      </div>
    );
  }
  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-2xl border p-3 flex items-center gap-3 transition-transform active:scale-95 hover:-translate-y-0.5"
      style={{ background: `linear-gradient(135deg, ${accent}22, rgba(255,255,255,0.02))`, borderColor: accent + "40" }}
    >
      <div className="rounded-xl p-2" style={{ background: accent + "22" }}>
        <Icon size={16} style={{ color: accent }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</div>
        <div className="text-sm text-white disp truncate">{entry.p.name}</div>
      </div>
      <div className="text-right">
        <div className="disp text-lg" style={{ color: accent }}>{value}</div>
        <div className="text-[8px] text-gray-500">{suffix}</div>
      </div>
    </button>
  );
}

function EstadisticasTab({ leaders, idealTeam, onOpenProfile }) {
  const {
    topScorer, topAssist, mostMVP, mostMatches, highestAvg, bestKeeper, cleanSheetsMap, breakout,
    mostOffensive, bestSingleGoal, bestSingleAssist, bestStreak, mostAchievements,
  } = leaders;
  const idealTeamDisplay = {
    ARQ: idealTeam.ARQ.map((p) => ({ playerId: p.id, name: p.name, number: p.number, rating: p.avg })),
    DEF: idealTeam.DEF.map((p) => ({ playerId: p.id, name: p.name, number: p.number, rating: p.avg })),
    MED: idealTeam.MED.map((p) => ({ playerId: p.id, name: p.name, number: p.number, rating: p.avg })),
    DEL: idealTeam.DEL.map((p) => ({ playerId: p.id, name: p.name, number: p.number, rating: p.avg })),
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="disp text-white text-2xl tracking-wide">Estadísticas</h2>
        <BarChart3 size={20} style={{ color: "#0D6EFD" }} />
      </div>

      <div className="flex flex-col gap-2 mb-6">
        <StatLeaderCard icon={Goal} label="Máximo goleador" entry={topScorer} value={topScorer?.t.goals ?? "—"} suffix="goles reales" accent="#0D6EFD" onOpen={() => topScorer && onOpenProfile(topScorer.p.id)} />
        <StatLeaderCard icon={Target} label="Máximo asistidor" entry={topAssist} value={topAssist?.t.assists ?? "—"} suffix="asistencias reales" accent="#00C853" onOpen={() => topAssist && onOpenProfile(topAssist.p.id)} />
        <StatLeaderCard icon={ShieldCheck} label="Mejor arquero" entry={bestKeeper} value={bestKeeper ? (cleanSheetsMap[bestKeeper.p.id] || 0) : "—"} suffix="vallas invictas" accent="#FFD54F" onOpen={() => bestKeeper && onOpenProfile(bestKeeper.p.id)} />
        <StatLeaderCard icon={Crown} label="Más MVP" entry={mostMVP} value={mostMVP?.t.votes ?? "—"} suffix={mostMVP ? `votos figura · ${mostMVP.t.mvpPoints} pts` : "votos figura"} accent="#FFD54F" onOpen={() => mostMVP && onOpenProfile(mostMVP.p.id)} />
        <StatLeaderCard icon={CalendarDays} label="Más partidos" entry={mostMatches} value={mostMatches?.t.pj ?? "—"} suffix="PJ" accent="#0D6EFD" onOpen={() => mostMatches && onOpenProfile(mostMatches.p.id)} />
        <StatLeaderCard icon={Star} label="Promedio más alto" entry={highestAvg} value={highestAvg ? (highestAvg.t.score / highestAvg.t.pj).toFixed(1) : "—"} suffix="nota" accent="#00C853" onOpen={() => highestAvg && onOpenProfile(highestAvg.p.id)} />
        <StatLeaderCard icon={Sparkles} label="Jugador revelación" entry={breakout} value={breakout ? (breakout.t.score / breakout.t.pj).toFixed(1) : "—"} suffix="nota inicial" accent="#0D6EFD" onOpen={() => breakout && onOpenProfile(breakout.p.id)} />
      </div>

      <h3 className="disp text-white text-lg tracking-wide mb-2 flex items-center gap-2">📚 Récords Mercenarios FC</h3>
      <div className="flex flex-col gap-2 mb-6">
        <StatLeaderCard icon={Goal} label="Más goles en un partido" entry={bestSingleGoal} value={bestSingleGoal?.value ?? "—"} suffix="goles en una fecha" accent="#EF4444" onOpen={() => bestSingleGoal && onOpenProfile(bestSingleGoal.p.id)} />
        <StatLeaderCard icon={Target} label="Más asistencias en un partido" entry={bestSingleAssist} value={bestSingleAssist?.value ?? "—"} suffix="asistencias en una fecha" accent="#00C853" onOpen={() => bestSingleAssist && onOpenProfile(bestSingleAssist.p.id)} />
        <StatLeaderCard icon={Flame} label="Mayor racha goleadora" entry={bestStreak} value={bestStreak?.ach.maxGoalStreak ?? "—"} suffix="partidos seguidos anotando" accent="#FFD54F" onOpen={() => bestStreak && onOpenProfile(bestStreak.p.id)} />
        <StatLeaderCard icon={Sparkles} label="Mejor participación ofensiva" entry={mostOffensive} value={mostOffensive?.t.offensive ?? "—"} suffix="pts (goles + asist. ponderados)" accent="#0D6EFD" onOpen={() => mostOffensive && onOpenProfile(mostOffensive.p.id)} />
        <StatLeaderCard icon={Medal} label="Más logros obtenidos" entry={mostAchievements} value={mostAchievements ? mostAchievements.ach.list.filter((i) => i.unlocked).length : "—"} suffix="logros desbloqueados" accent="#FFD54F" onOpen={() => mostAchievements && onOpenProfile(mostAchievements.p.id)} />
      </div>

      <h3 className="disp text-white text-lg tracking-wide mb-2 flex items-center gap-2"><Users size={16} style={{ color: "#FFD54F" }} /> Equipo ideal histórico</h3>
      <TeamOfMatch team={idealTeamDisplay} />
    </div>
  );
}

function ConfiguracionTab({ players, currentPlayer, onChangeUser, season, isAdmin, onLogin, onLogout }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="disp text-white text-2xl tracking-wide">Configuración</h2>
        <Settings size={20} style={{ color: "#0D6EFD" }} />
      </div>

      <div className="rounded-2xl border border-gray-800 p-4 mb-3" style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Tu identidad</div>
        <div className="flex items-center gap-3">
          <span className="jersey" style={{ width: 40, height: 40 }}>{currentPlayer ? currentPlayer.number : "?"}</span>
          <div className="flex-1 min-w-0">
            <div className="disp text-white text-sm truncate">{currentPlayer ? currentPlayer.name : "Sin elegir"}</div>
            <div className="text-[10px] text-gray-500">{currentPlayer ? posLabel(currentPlayer.position) : "Elegí quién sos para votar"}</div>
          </div>
          <button onClick={onChangeUser} className="text-xs px-3 py-1.5 rounded-full text-white shrink-0" style={{ background: "#0D6EFD" }}>Cambiar</button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-800 p-4 mb-3" style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Plantel</div>
        <div className="flex items-center justify-between text-sm text-gray-300">
          <span>Jugadores cargados</span>
          <span className="disp text-white">{players.length}/{MAX_PLAYERS}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-800 p-4 mb-3" style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Acceso administrador</div>
        {isAdmin ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(13,110,253,0.12)", border: "1.5px solid #0D6EFD" }}>
              <ShieldCheck size={16} style={{ color: "#0D6EFD" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="disp text-white text-sm">Sesión de administrador activa</div>
              <div className="text-[10px] text-gray-500">Podés cargar y editar jugadores y partidos</div>
            </div>
            <button onClick={onLogout} className="text-xs px-3 py-1.5 rounded-full text-gray-300 border border-gray-700 flex items-center gap-1 shrink-0">
              <LogOut size={12} /> Salir
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 border border-gray-700" style={{ background: "rgba(255,255,255,0.03)" }}>
              <Lock size={14} className="text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-300">Solo el administrador puede editar</div>
              <div className="text-[10px] text-gray-500">Iniciá sesión para cargar jugadores y partidos</div>
            </div>
            <button onClick={onLogin} className="text-xs px-3 py-1.5 rounded-full text-white shrink-0" style={{ background: "#0D6EFD" }}>Ingresar</button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-800 p-4" style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Acerca de</div>
        <div className="text-sm text-gray-300 disp">Mercenarios FC</div>
        <div className="text-[10px] text-gray-500">{season} · Estadísticas del grupo</div>
      </div>
    </div>
  );
}

/* ---------- Avatares por posición (silueta de acción, sin foto todavía) ---------- */

function AvatarDelantero({ color }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="42" cy="26" r="8" fill={color} />
      <path d="M42 34 L38 54" stroke={color} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M38 54 L26 72" stroke={color} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M40 50 L64 42" stroke={color} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M41 40 L26 34" stroke={color} strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M41 40 L56 46" stroke={color} strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle cx="78" cy="36" r="7" fill="none" stroke={color} strokeWidth="3" />
    </svg>
  );
}
function AvatarMediocampista({ color }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="48" cy="26" r="8" fill={color} />
      <path d="M48 34 L46 56" stroke={color} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M46 56 L34 76" stroke={color} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M46 56 L64 68" stroke={color} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M47 42 L30 40" stroke={color} strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M47 42 L62 36" stroke={color} strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle cx="70" cy="70" r="6" fill="none" stroke={color} strokeWidth="3" />
    </svg>
  );
}
function AvatarDefensor({ color }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="30" cy="34" r="8" fill={color} />
      <path d="M30 42 L46 54" stroke={color} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M46 54 L74 60" stroke={color} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M46 54 L40 74" stroke={color} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M32 46 L18 52" stroke={color} strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M32 46 L34 62" stroke={color} strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle cx="80" cy="62" r="6" fill="none" stroke={color} strokeWidth="3" />
    </svg>
  );
}
function AvatarArquero({ color }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="30" r="8" fill={color} />
      <path d="M50 38 L50 56" stroke={color} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M50 56 L38 76" stroke={color} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M50 56 L62 76" stroke={color} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M50 42 L26 22" stroke={color} strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M50 42 L74 22" stroke={color} strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle cx="22" cy="18" r="6" fill="none" stroke={color} strokeWidth="3" />
    </svg>
  );
}
const POSITION_AVATAR = { DEL: AvatarDelantero, MED: AvatarMediocampista, DEF: AvatarDefensor, ARQ: AvatarArquero };
function PositionAvatar({ position, ring, size = 72 }) {
  const Comp = POSITION_AVATAR[position] || AvatarMediocampista;
  return (
    <div className="rounded-full flex items-center justify-center p-3" style={{ width: size, height: size, background: "linear-gradient(160deg,#161b22,#05070a)", border: `2px solid ${ring}` }}>
      <Comp color={ring} />
    </div>
  );
}

function TrendChip({ trend }) {
  const m = TREND_META[trend.status];
  return (
    <span className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-full border disp" style={{ borderColor: m.color + "55", color: m.color, background: m.color + "15" }}>
      {m.emoji} {m.label}{trend.delta !== undefined ? ` (${trend.delta > 0 ? "+" : ""}${trend.delta.toFixed(2)})` : ""}
    </span>
  );
}

/* ---------- Carta de jugador estilo videojuego (solo datos reales) ---------- */

function PlayerCard({ player, t, matches, votes, isMvpLeader }) {
  const avg = t.pj > 0 ? t.score / t.pj : 0;
  const tier = tierFromAvg(avg, t.pj, isMvpLeader);
  const meta = CARD_TIERS[tier];
  const { list: achievements, maxGoalsMatch, bestRating } = computeAchievements(player, matches, votes);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const { level, progress } = computeLevel(t, matches, player, unlockedCount);
  const trend = computeTrend(player, matches, votes);

  return (
    <div className="relative rounded-[24px] p-4 border-2 overflow-hidden" style={{ background: meta.grad, borderColor: meta.ring, boxShadow: `0 16px 40px -16px ${meta.ring}88` }}>
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-30 pointer-events-none" style={{ background: `radial-gradient(circle, ${meta.ring}, transparent 70%)`, filter: "blur(6px)" }} />

      <div className="relative flex items-start justify-between">
        <div>
          <div className="disp leading-none" style={{ fontFamily: "'Bebas Neue','Oswald',sans-serif", fontSize: 40, color: meta.ring }}>{avg.toFixed(2)}</div>
          <div className="text-[10px] text-gray-300 disp -mt-1">Promedio · {player.position}</div>
        </div>
        <span className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-full border disp" style={{ borderColor: meta.ring + "88", color: meta.ring, background: "#00000055" }}>
          {meta.emoji} {meta.label}
        </span>
      </div>

      <div className="relative flex flex-col items-center mt-1">
        <div className="relative">
          <PlayerAvatar player={player} ring={meta.ring} size={78} />
          <span className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center disp" style={{ width: 26, height: 26, fontSize: 11, background: "#0b0d11", border: `1.5px solid ${meta.ring}`, color: meta.ring }}>{player.number}</span>
        </div>
        <div className="disp text-white text-base mt-2">{player.name}</div>
        <div className="text-[10px] text-gray-400">{posLabel(player.position)}</div>
        <div className="mt-1.5"><TrendChip trend={trend} /></div>
      </div>

      <div className="relative mt-3">
        <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
          <span className="flex items-center gap-1"><Clock size={11} style={{ color: meta.ring }} /> Nivel {level} · trayectoria</span>
          <span>{progress}/100 XP</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: progress + "%", background: `linear-gradient(90deg, ${meta.ring}, #ffffff55)` }} />
        </div>
      </div>

      <div className="relative grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t" style={{ borderColor: meta.ring + "33" }}>
        {[["PJ", t.pj], ["⚽ Goles", t.goals], ["🎯 Asist.", t.assists], ["🗳️ MVP", t.votes]].map(([label, val]) => (
          <div key={label} className="text-center">
            <div className="disp text-white text-sm">{val}</div>
            <div className="text-[8px] text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="relative grid grid-cols-3 gap-1.5 mt-2 pt-2 border-t" style={{ borderColor: meta.ring + "22" }}>
        {[["⭐ Gol. pond.", t.goalsW ?? 0], ["⭐ Asist. pond.", t.assistsW ?? 0], ["🔥 Of. total", t.offensive ?? 0]].map(([label, val]) => (
          <div key={label} className="text-center">
            <div className="disp text-xs" style={{ color: meta.ring }}>{val}</div>
            <div className="text-[8px] text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="relative flex items-center justify-between mt-3 pt-3 border-t text-[10px]" style={{ borderColor: meta.ring + "33" }}>
        <span className="flex items-center gap-1 text-gray-400"><Medal size={11} style={{ color: meta.ring }} /> {unlockedCount}/{achievements.length} logros</span>
        <span className="flex items-center gap-1 text-gray-400"><Award size={11} style={{ color: "#FFD54F" }} /> Mejor partido: {bestRating.toFixed(1)} · {maxGoalsMatch} goles</span>
      </div>
      {(t.presenciasF56 || 0) > 0 && (
        <div className="relative mt-1.5 text-[9px] text-gray-500">
          + {t.presenciasF56} presencia{t.presenciasF56 === 1 ? "" : "s"} en F5/F6 (no oficial) · aporte de Ranking: +{(t.rankingBonus || 0).toFixed(1)}
        </div>
      )}
    </div>
  );
}

function PersonalRecords({ player, matches, votes, mvpPoints }) {
  const { maxGoalsMatch, maxAssistsMatch, maxMvpStreak, maxGoalStreak, bestRating } = computeAchievements(player, matches, votes);
  const rows = [
    { label: "Mejor puntuación en un partido", value: bestRating.toFixed(1), icon: Star, color: "#FFD54F" },
    { label: "Más goles en un partido", value: maxGoalsMatch, icon: Goal, color: "#0D6EFD" },
    { label: "Más asistencias en un partido", value: maxAssistsMatch, icon: Target, color: "#00C853" },
    { label: "Mayor racha goleadora", value: maxGoalStreak, icon: Flame, color: "#EF4444" },
    { label: "Mayor racha de MVP", value: maxMvpStreak, icon: Crown, color: "#FFD54F" },
    { label: "Puntos acumulados por votos MVP", value: mvpPoints ?? 0, icon: Sparkles, color: "#0D6EFD" },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-gray-400"><r.icon size={12} style={{ color: r.color }} /> {r.label}</span>
          <span className="disp" style={{ color: r.color }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function AchievementsGrid({ player, matches, votes }) {
  const { list } = computeAchievements(player, matches, votes);
  return (
    <div className="grid grid-cols-2 gap-2">
      {list.map((a) => (
        <div key={a.id} className={`rounded-2xl border p-3 flex flex-col items-center text-center gap-1.5 ${a.unlocked ? "" : "opacity-40"}`} style={{ borderColor: a.unlocked ? a.color + "55" : "#1f2937", background: a.unlocked ? a.color + "14" : "rgba(255,255,255,0.02)" }}>
          {a.comingSoon ? <Lock size={20} className="text-gray-600" /> : <a.icon size={20} style={{ color: a.unlocked ? a.color : "#4b5563" }} />}
          <span className="text-[11px] disp text-gray-200 leading-tight">{a.label}</span>
          <span className="text-[9px] text-gray-500">{a.comingSoon ? "Próximamente" : a.unlocked ? "Desbloqueado" : "Bloqueado"}</span>
        </div>
      ))}
    </div>
  );
}

const PERFIL_SECTIONS = [
  ["carta", "Carta"],
  ["evolucion", "Evolución"],
  ["logros", "Logros"],
];

function PerfilTab({ players, profilePlayer, setProfileId, totals, history, onBack, matches, votes }) {
  const [section, setSection] = useState("carta");

  if (!profilePlayer) {
    return <p className="text-sm text-gray-500">Sumá jugadores para ver perfiles.</p>;
  }
  const t = totals[profilePlayer.id] || { pj: 0, goals: 0, assists: 0, votes: 0, ownGoals: 0, score: 0, goalsW: 0, assistsW: 0, mvpPoints: 0, offensive: 0, presenciasF56: 0, rankingBonus: 0 };
  const avg = t.pj > 0 ? t.score / t.pj : 0;
  const last5 = history.slice(-5);
  const mvpLeaderId = [...players].map((p) => ({ id: p.id, votes: (totals[p.id] || {}).votes || 0 })).sort((a, b) => b.votes - a.votes)[0]?.id;
  const isMvpLeader = profilePlayer.id === mvpLeaderId;
  const tier = tierFromAvg(avg, t.pj, isMvpLeader);
  const meta = CARD_TIERS[tier];
  const trend = computeTrend(profilePlayer, matches, votes);
  const { list: achievements } = computeAchievements(profilePlayer, matches, votes);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const { level, progress, weeksInTeam } = computeLevel(t, matches, profilePlayer, unlockedCount);

  return (
    <div>
      <button onClick={onBack} className="text-xs text-gray-500 mb-2 flex items-center gap-1">← Volver</button>

      <select
        value={profilePlayer.id}
        onChange={(e) => setProfileId(e.target.value)}
        className="w-full mb-3 bg-gray-900/70 border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200"
      >
        {players.map((p) => <option key={p.id} value={p.id}>#{p.number} {p.name}</option>)}
      </select>

      <div className="flex gap-1.5 mb-4 overflow-x-auto">
        {PERFIL_SECTIONS.map(([key, label]) => {
          const active = section === key;
          return (
            <button
              key={key}
              onClick={() => setSection(key)}
              className="text-xs px-3 py-1.5 rounded-full border shrink-0 disp"
              style={active ? { background: "#0D6EFD", borderColor: "#0D6EFD", color: "#fff" } : { background: "rgba(255,255,255,0.03)", borderColor: "#1f2937", color: "#9ca3af" }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {section === "carta" && (
        <PlayerCard player={profilePlayer} t={t} matches={matches} votes={votes} isMvpLeader={isMvpLeader} />
      )}

      {section === "evolucion" && (
        <div>
          <div
            className="relative rounded-[24px] overflow-hidden p-5 mb-4 border"
            style={{ borderColor: meta.ring + "55", background: `linear-gradient(160deg, ${meta.ring}22, #0b0d11 65%)`, boxShadow: `0 12px 32px -12px ${meta.ring}66` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="disp text-4xl" style={{ color: meta.ring }}>{avg ? avg.toFixed(2) : "—"}</div>
                <div className="text-[9px] text-gray-400 uppercase tracking-wider">Promedio de rendimiento</div>
              </div>
              <div className="relative">
                <PlayerAvatar player={profilePlayer} ring={meta.ring} size={56} />
                <span className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center disp" style={{ width: 20, height: 20, fontSize: 9, background: "#0b0d11", border: `1.5px solid ${meta.ring}`, color: meta.ring }}>{profilePlayer.number}</span>
              </div>
            </div>
            <div className="mt-2">
              <div className="disp text-white text-2xl leading-tight">{profilePlayer.name}</div>
              <div className="text-xs text-gray-400">{posLabel(profilePlayer.position)} · {meta.emoji} {meta.label}</div>
            </div>
            <div className="mt-2"><TrendChip trend={trend} /></div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                <span className="flex items-center gap-1"><Clock size={12} style={{ color: meta.ring }} /> Nivel {level} — trayectoria en el plantel</span>
                <span>{progress}/100 XP</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: progress + "%", background: `linear-gradient(90deg, ${meta.ring}, #ffffff55)` }} />
              </div>
              <div className="text-[9px] text-gray-600 mt-1">{t.pj} partidos disputados · ~{weeksInTeam} semanas en el plantel · {unlockedCount} logros — el nivel no depende del promedio.</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-2">
            {[["PJ", t.pj], ["⚽ Goles reales", t.goals], ["🎯 Asist. reales", t.assists], ["🗳️ Votos MVP", t.votes]].map(([label, val]) => (
              <div key={label} className="rounded-xl py-2.5 text-center border border-gray-800" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="disp text-white text-base">{val}</div>
                <div className="text-[9px] text-gray-500">{label}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[["⭐ Goles pond.", t.goalsW ?? 0], ["⭐ Asist. pond.", t.assistsW ?? 0], ["🔥 Particip. ofensiva", t.offensive ?? 0], ["⭐ Pts. MVP", t.mvpPoints ?? 0]].map(([label, val]) => (
              <div key={label} className="rounded-xl py-2.5 text-center border border-gray-800" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="disp text-base" style={{ color: meta.ring }}>{val}</div>
                <div className="text-[9px] text-gray-500">{label}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-600 -mt-2 mb-4">Estadística oficial: solo partidos F8/F9 (1 pto por gol o asistencia). Participación ofensiva = goles ponderados + asistencias ponderadas. F5/F6 no suma acá.</p>

          <h3 className="disp text-sm text-gray-300 mb-2 tracking-wide uppercase">Evolución del promedio</h3>
          {history.length < 2 ? (
            <p className="text-xs text-gray-600 mb-4">Se necesitan al menos 2 partidos cargados para ver la evolución.</p>
          ) : (
            <div className="rounded-2xl border border-gray-800 p-2 mb-4" style={{ height: 180, background: "rgba(255,255,255,0.02)" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid stroke="#1a1f2b" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis domain={[2, 10]} tick={{ fontSize: 9, fill: "#6b7280" }} width={24} />
                  <Tooltip contentStyle={{ background: "#0c0f14", border: "1px solid #1f2937", fontSize: 11 }} labelStyle={{ color: "#9ca3af" }} />
                  <Line type="monotone" dataKey="score" stroke="#0D6EFD" strokeWidth={2.5} dot={{ r: 3, fill: "#0D6EFD" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <h3 className="disp text-sm text-gray-300 mb-2 tracking-wide uppercase">Últimos partidos</h3>
          <div className="flex flex-col gap-1.5 mb-2">
            {last5.slice().reverse().map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-xl px-3 py-2 text-xs border border-gray-800" style={{ background: "rgba(255,255,255,0.02)" }}>
                <span className="text-gray-400">{new Date(h.date + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</span>
                <span className="text-gray-500">{h.mode}</span>
                <span className="disp font-bold rounded-md px-1.5" style={{ color: "#0b0b0b", background: ratingColor(h.score) }}>{h.score.toFixed(1)}</span>
              </div>
            ))}
            {history.length === 0 && <p className="text-xs text-gray-600">Todavía no jugó ningún partido cargado.</p>}
          </div>
        </div>
      )}

      {section === "logros" && (
        <div>
          <h3 className="disp text-sm text-gray-300 mb-2 tracking-wide uppercase">Logros</h3>
          <AchievementsGrid player={profilePlayer} matches={matches} votes={votes} />
          <h3 className="disp text-sm text-gray-300 mb-2 mt-5 tracking-wide uppercase">Tus récords personales</h3>
          <div className="rounded-2xl border border-gray-800 p-4" style={{ background: "rgba(255,255,255,0.03)" }}>
            <PersonalRecords player={profilePlayer} matches={matches} votes={votes} mvpPoints={t.mvpPoints} />
          </div>
        </div>
      )}
    </div>
  );
}
