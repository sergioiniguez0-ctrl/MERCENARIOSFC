export const RECOGNITIONS = [
  {id:'goal', label:'Gol del partido'}, {id:'save',label:'Atajada de la fecha'},
  {id:'assist',label:'Asistencia del partido'}, {id:'defender',label:'Defensor del partido'},
  {id:'scorer',label:'Goleador del partido'}, {id:'engine',label:'Motor del equipo'},
  {id:'revelation',label:'Revelación de la fecha'}, {id:'play',label:'Jugada del partido'},
];
export const NEW_AWARD_LABELS = RECOGNITIONS.map(a=>a.label);
export function isScoringAward(award){return award.countsForRating!==false && !NEW_AWARD_LABELS.includes(award.label);}
export function awardBallotKey(matchId){return `awardBallots_${matchId}`;}
export function eligibleForAward(match, category){
  if(category==='scorer'){const max=Math.max(0,...(match.participants||[]).map(p=>Number(p.goals)||0));return max>0?(match.participants||[]).filter(p=>Number(p.goals)===max).map(p=>p.playerId):[];}
  if(category==='defender')return (match.participants||[]).filter(p=>['DEF','DFC','LAT'].includes(p.position)).map(p=>p.playerId);
  return (match.participants||[]).filter(p=>category==='save'?p.position==='ARQ':category==='goal'?Number(p.goals)>0:category==='assist'?Number(p.assists)>0:true).map(p=>p.playerId);
}
export function ballotLeaders(ballots, category){
 const counts={};for(const vote of Object.values(ballots||{})){const id=vote[category];if(id)counts[id]=(counts[id]||0)+1;}
 const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 return entries.filter(e=>e[1]===entries[0]?.[1]).map(([playerId,votes])=>({playerId,votes}));
}
