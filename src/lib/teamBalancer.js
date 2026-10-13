import {posGroupOf} from './sportsConfig.js';
export function effectiveStrength(player){
 const pj=Number(player.pj)||0;
 const conf=Math.max(0,Math.min(100,Number(player.confidence)||0))/100;
 return pj>0 ? (Number(player.avg)||6)*conf+6*(1-conf) : 6;
}
export function teamSummary(team){
 const positions={ARQ:0,DEF:0,MED:0,DEL:0};
 for(const p of team)if(posGroupOf(p.position) in positions)positions[posGroupOf(p.position)]++;
 const known=team.filter(p=>Number.isFinite(p.marketValue));
 const official=team.filter(p=>p.pj>0);
 return {count:team.length, officialAverage:official.length?official.reduce((s,p)=>s+(Number(p.avg)||0),0)/official.length:null, officialKnown:official.length, average:team.length?team.reduce((s,p)=>s+effectiveStrength(p),0)/team.length:0,
  marketTotal:known.reduce((s,p)=>s+p.marketValue,0), marketKnown:known.length, positions,
  rookies:team.filter(p=>!p.pj).length};
}
export function balanceCost(a,b){
 const x=teamSummary(a),y=teamSummary(b);
 return Math.abs(x.count-y.count)*100+Math.abs(x.average-y.average)*10+
  Math.abs(x.positions.ARQ-y.positions.ARQ)*8+['DEF','MED','DEL'].reduce((s,k)=>s+Math.abs(x.positions[k]-y.positions[k])*1.5,0);
}
export function balanceTeams(players){
 const sorted=[...players].sort((a,b)=>effectiveStrength(b)-effectiveStrength(a)||a.id.localeCompare(b.id));
 let a=[],b=[];const maxA=Math.ceil(sorted.length/2),maxB=Math.floor(sorted.length/2);
 for(const p of sorted){
  if(a.length>=maxA)b.push(p);else if(b.length>=maxB)a.push(p);
  else if(balanceCost([...a,p],b)<=balanceCost(a,[...b,p]))a.push(p);else b.push(p);
 }
 for(let round=0;round<100;round++){
  let best=balanceCost(a,b),swap=null;
  for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
   const aa=[...a],bb=[...b];[aa[i],bb[j]]=[bb[j],aa[i]];
   const cost=balanceCost(aa,bb);if(cost<best-0.000001){best=cost;swap=[i,j];}
  }
  if(!swap)break;const [i,j]=swap;[a[i],b[j]]=[b[j],a[i]];
 }
 return {A:a.map(p=>p.id),B:b.map(p=>p.id)};
}
export function validatePreview(draft, players, requireTeams=false){
 if(!draft||!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)||!['Fútbol 5','Fútbol 6','Fútbol 8','Fútbol 9'].includes(draft.mode))throw new Error('Completá una fecha y modalidad válidas.');
 const parsedDate=new Date(draft.date+'T12:00:00Z');if(!Number.isFinite(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==draft.date)throw new Error('La fecha no es válida.');
 const valid=new Set(players.map(p=>p.id));const ids=draft.convocadoIds||[];
 if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!valid.has(id)))throw new Error('Revisá los convocados.');
 const a=draft.teams?.A||[],b=draft.teams?.B||[];
 const assigned=[...a,...b];
 if(new Set(assigned).size!==assigned.length||assigned.some(id=>!ids.includes(id)))throw new Error('Un jugador no puede estar en ambos equipos.');
 if(requireTeams&&(assigned.length!==ids.length||Math.abs(a.length-b.length)>1||!a.length||!b.length))throw new Error('Asigná todos los convocados a dos equipos de tamaño parejo.');
 return draft;
}
