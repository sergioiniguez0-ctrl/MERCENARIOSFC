// ---------- Compromiso (v3.1) ----------
// El compromiso se calcula ÚNICAMENTE por la presencia en los partidos: nada de
// puntualidad, confirmaciones, cancelaciones ni conducta fuera de la cancha. Es una
// función pura sobre `matches`, igual que marketValue.js — no agrega nada a Firestore.

// Recorre, desde la primera fecha en la que el jugador participó, TODAS las fechas
// del plantel (jugó o no) para poder calcular un porcentaje de presencia real.
export function computeCommitment(player, matches) {
  const sorted = [...(matches || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
  const playerMatches = sorted.filter((m) => m.participants?.some((p) => p.playerId === player.id));

  if (playerMatches.length === 0) {
    return { pj: 0, totalEligible: 0, percentage: null, currentStreak: 0, bestStreak: 0, recent: [] };
  }

  const firstDate = playerMatches[0].date;
  const eligible = sorted.filter((m) => String(m.date) >= String(firstDate));
  const presenceFlags = eligible.map((m) => m.participants.some((p) => p.playerId === player.id));

  const pj = playerMatches.length;
  const percentage = eligible.length > 0 ? Math.round((pj / eligible.length) * 100) : null;

  let currentStreak = 0;
  for (let i = presenceFlags.length - 1; i >= 0; i--) {
    if (presenceFlags[i]) currentStreak++;
    else break;
  }

  let bestStreak = 0;
  let running = 0;
  presenceFlags.forEach((present) => {
    running = present ? running + 1 : 0;
    bestStreak = Math.max(bestStreak, running);
  });

  const recent = eligible.slice(-5).map((m, idx) => ({
    date: m.date,
    present: presenceFlags[presenceFlags.length - Math.min(5, eligible.length) + idx],
  }));

  return { pj, totalEligible: eligible.length, percentage, currentStreak, bestStreak, recent };
}
