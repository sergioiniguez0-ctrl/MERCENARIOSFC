import {computeMatchRating} from './rating.js';
import {isOfficialMode,posGroupOf} from './sportsConfig.js';
export function buildSocieties(matches,votes={}) {
 const pairs=new Map(),captains=new Map();
 for(const m of [...matches].filter(m=>isOfficialMode(m.mode)).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.id).localeCompare(String(b.id)))) {
  for(const side of ['A','B']) {
   const team=m.participants.filter(p=>p.team===side);
   const captain=m.captains?.[side];
   if(captain&&team.some(p=>p.playerId===captain)) {
    const r=computeMatchRating(m,captain,votes[m.id]);
    const c=captains.get(captain)||{id:captain,pj:0,wins:0,draws:0,losses:0};
    c.pj++;if(r.win)c.wins++;else if(r.teamGoals===r.rivalGoals)c.draws++;else c.losses++;captains.set(captain,c);
   }
   for(let i=0;i<team.length;i++) for(let j=i+1;j<team.length;j++) {
    const a=team[i],b=team[j],ids=[a.playerId,b.playerId].sort(),key=JSON.stringify(ids);
    const row=pairs.get(key)||{key,ids,pj:0,wins:0,draws:0,conceded:0,goals:0,assists:0,totalRating:0,groups:{DEF:0,MED:0,DEL:0},streak:0,bestStreak:0};
    const ar=computeMatchRating(m,a.playerId,votes[m.id]),br=computeMatchRating(m,b.playerId,votes[m.id]);
    row.pj++;row.wins+=Number(ar.win);row.draws+=Number(ar.teamGoals===ar.rivalGoals);
    row.conceded+=ar.rivalGoals;row.goals+=ar.goals+br.goals;row.assists+=ar.assists+br.assists;row.totalRating+=(ar.rating+br.rating)/2;
    const group=posGroupOf(a.position);if(group===posGroupOf(b.position)&&group in row.groups)row.groups[group]++;
    row.streak=ar.win?row.streak+1:0;row.bestStreak=Math.max(row.bestStreak,row.streak);pairs.set(key,row);
   }
  }
 }
 return {pairs:[...pairs.values()].map(p=>({...p,winRate:p.wins/p.pj,average:p.totalRating/p.pj,concededAverage:p.conceded/p.pj})),captains:[...captains.values()].sort((a,b)=>b.wins/b.pj-a.wins/a.pj||b.pj-a.pj)};
}
