import {computeMatchRating} from './rating.js';
import {teamGoalsFor} from './sportsConfig.js';
import {displayName} from './playerProfile.js';
const OFFICIAL=['Fútbol 8','Fútbol 9'];
export function localToday(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function weekRange(date){const d=new Date(date+'T12:00:00Z');const day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);const start=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+6);return {start,end:d.toISOString().slice(0,10)};}
export function shiftWeek(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n*7);return d.toISOString().slice(0,10);}
export function rankingSnapshot(players,matches,votes){
 const totals=Object.fromEntries(players.map(p=>[p.id,{pj:0,score:0,confidence:0,presenciasF56:0,bonus:0}]));
 for(const m of matches){
  const maxGoals=Math.max(0,...m.participants.map(p=>Number(p.goals)||0));
  for(const part of m.participants){const t=totals[part.playerId];if(!t)continue;t.confidence=Math.min(100,t.confidence+(OFFICIAL.includes(m.mode)?20:['Fútbol 5','Fútbol 6'].includes(m.mode)?1:0));
   if(OFFICIAL.includes(m.mode)){t.pj++;t.score+=computeMatchRating(m,part.playerId,votes[m.id])?.rating||0;}
   else if(['Fútbol 5','Fútbol 6'].includes(m.mode)){t.presenciasF56++;t.bonus+=0.1+(teamGoalsFor(m,part.team)>teamGoalsFor(m,part.team==='A'?'B':'A')?0.1:0)+(maxGoals>0&&Number(part.goals)===maxGoals?0.1:0);}
  }
 }
 return players.map(p=>{const t=totals[p.id],avg=t.pj?t.score/t.pj:0;const bonus=Math.round(t.bonus*100)/100;return {...p,...t,avg,rankingScore:Math.round(((t.pj?avg*t.confidence/100+6*(1-t.confidence/100):0)+bonus)*100)/100};}).sort((a,b)=>b.rankingScore-a.rankingScore||b.pj-a.pj||b.presenciasF56-a.presenciasF56);
}
export function buildWeeklyJournal({players,matches,votes={},date=localToday(),today=localToday()}){
 const range=weekRange(date),cutoff=range.end<today?range.end:today;
 const past=matches.filter(m=>m.date<=cutoff),weekly=past.filter(m=>m.date>=range.start).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
 const byId=Object.fromEntries(players.map(p=>[p.id,p])),name=id=>displayName(byId[id]);
 const official=weekly.filter(m=>OFFICIAL.includes(m.mode));
 const contributions={};
 for(const m of official)for(const p of m.participants){if(!contributions[p.playerId])contributions[p.playerId]={id:p.playerId,goals:0,assists:0,pj:0,rating:0};const t=contributions[p.playerId];t.goals+=Number(p.goals)||0;t.assists+=Number(p.assists)||0;t.pj++;t.rating+=computeMatchRating(m,p.playerId,votes[m.id])?.rating||0;}
 const scorer=Object.values(contributions).sort((a,b)=>b.goals-a.goals||a.id.localeCompare(b.id))[0];
 const topScorers=scorer?.goals?Object.values(contributions).filter(p=>p.goals===scorer.goals):[];
 const ranking=rankingSnapshot(players,past,votes),before=rankingSnapshot(players,past.filter(m=>m.date<range.start),votes);
 const beforePositions=Object.fromEntries(before.map((p,i)=>[p.id,i]));
 const movement=ranking.filter(p=>p.pj||p.presenciasF56).map((p,i)=>({id:p.id,name:name(p.id),position:i+1,change:beforePositions[p.id]-i,score:p.rankingScore}));
 const streakItems=[];const ordered=past.filter(m=>OFFICIAL.includes(m.mode)).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 for(const pl of players){let goals=0,wins=0,record=0;for(const m of ordered){const p=m.participants.find(p=>p.playerId===pl.id);if(!p){goals=0;wins=0;continue;}goals=Number(p.goals)>0?goals+1:0;wins=teamGoalsFor(m,p.team)>teamGoalsFor(m,p.team==='A'?'B':'A')?wins+1:0;record=Math.max(record,Number(p.goals)||0);}
  if(goals>=2)streakItems.push({importance:goals+10,text:`${name(pl.id)} lleva ${goals} partidos oficiales consecutivos con gol.`});
  if(wins>=3)streakItems.push({importance:wins,text:`${name(pl.id)} suma ${wins} victorias oficiales consecutivas.`});
  const priorMax=Math.max(0,...ordered.filter(m=>m.date<range.start).flatMap(m=>m.participants.filter(p=>p.playerId===pl.id).map(p=>Number(p.goals)||0)));
  if(record>priorMax&&record>1&&official.some(m=>m.participants.some(p=>p.playerId===pl.id&&Number(p.goals)===record)))streakItems.push({importance:record+20,text:`${name(pl.id)} alcanzó su récord registrado: ${record} goles en un partido oficial.`});
 }
 const streaks=streakItems.sort((a,b)=>b.importance-a.importance||a.text.localeCompare(b.text)).slice(0,6).map(x=>x.text);
 const headline=topScorers.length?`${topScorers.map(p=>name(p.id)).join(' y ')}: ${scorer.goals} goles en la semana`:weekly.length?`${weekly.length} fecha${weekly.length>1?'s':''}, una nueva historia del grupo`:'La semana de Mercenarios';
 const summaries=weekly.map(m=>{const a=teamGoalsFor(m,'A'),b=teamGoalsFor(m,'B');const scorers=m.participants.filter(p=>Number(p.goals)>0).map(p=>`${name(p.playerId)} (${p.goals})`);const assists=m.participants.filter(p=>Number(p.assists)>0).map(p=>`${name(p.playerId)} (${p.assists})`);
  const counts={};for(const id of Object.values(votes[m.id]||{}))counts[id]=(counts[id]||0)+1;const max=Math.max(0,...Object.values(counts));const mvp=Object.entries(counts).filter(([,n])=>n===max).map(([id])=>name(id));
  return {id:m.id,date:m.date,mode:m.mode,official:OFFICIAL.includes(m.mode),title:`${m.teamAName||'Equipo A'} ${a}–${b} ${m.teamBName||'Equipo B'}`,scorers,assists,awards:(m.awards||[]).map(a=>`${a.label}: ${name(a.playerId)}`),mvp:mvp.length?`${m.votingOpen?'Votación provisional':'Figura'}: ${mvp.join(' / ')} (${max} votos${m.votingOpen?', abierta':''})`:null};});
 return {range,headline,summaries,movement,streaks,goals:official.reduce((s,m)=>s+m.participants.reduce((n,p)=>n+(Number(p.goals)||0),0),0),officialCount:official.length,weeklyCount:weekly.length,ranking:ranking.filter(p=>p.pj||p.presenciasF56).slice(0,3),topScorers};
}
export function headToHead(draft,matches){
 const teamKey=ids=>[...ids].sort().join('|');const a=teamKey(draft?.teams?.A||[]),b=teamKey(draft?.teams?.B||[]);
 if(!a||!b)return {played:0,A:0,B:0,draws:0};
 const result={played:0,A:0,B:0,draws:0};
 for(const m of matches){const x=teamKey(m.participants.filter(p=>p.team==='A').map(p=>p.playerId)),y=teamKey(m.participants.filter(p=>p.team==='B').map(p=>p.playerId));let side;if(x===a&&y===b)side='A';else if(x===b&&y===a)side='B';else continue;result.played++;const ga=teamGoalsFor(m,side),gb=teamGoalsFor(m,side==='A'?'B':'A');result[ga===gb?'draws':ga>gb?'A':'B']++;}return result;
}
