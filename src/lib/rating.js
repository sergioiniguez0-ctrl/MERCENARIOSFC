import { isScoringAward } from "./recognitions.js";
import { coefficientsFor, posGroupOf, teamGoalsFor, isOfficialMode } from "./sportsConfig.js";

export const RATING_CONFIG = { BASE:6, GOAL_INC:0.7, ASSIST_INC:0.4,
 CLEAN_SHEET_INC:0.5, WIN_INC:0.3, VOTE_INC:0.2, VOTE_CAP:3,
 AWARD_INC:0.3, AWARD_CAP:2, OWN_GOAL_DEC:1, CAPTAIN_LOSS_DEC:0.5,
 IMPROVEMENT_INC:0.2, MIN:2, MAX:10 };
// Cada escalón exige el doble de mérito: 1, 2, 4 y 8 puntos adicionales.
export function progressiveRating(merit) {
 let left=Math.max(0,merit), result=6;
 for(const cost of [1,2,4,8]) {const used=Math.min(left,cost);result+=used/cost;left-=used;}
 return Math.min(10,result);
}
export function computeMatchRating(match, playerId, mvpVotes) {
 const p=match.participants.find(x=>x.playerId===playerId); if(!p)return null;
 const c=RATING_CONFIG, teamGoals=teamGoalsFor(match,p.team), rivalGoals=teamGoalsFor(match,p.team==='A'?'B':'A');
 const goals=Number(p.goals)||0, assists=Number(p.assists)||0, ownGoals=Number(p.ownGoals)||0;
 const win=teamGoals>rivalGoals, cleanSheet=['ARQ','DEF'].includes(posGroupOf(p.position))&&rivalGoals===0;
 const votes=mvpVotes?Object.values(mvpVotes).filter(v=>v===playerId).length:0;
 const awards=(match.awards||[]).filter(a=>a.playerId===playerId), coef=coefficientsFor(p.position);
 const breakdown={goals:goals*c.GOAL_INC*coef.goal,assists:assists*c.ASSIST_INC*coef.assist,
 win:win?c.WIN_INC:0,cleanSheet:cleanSheet?c.CLEAN_SHEET_INC:0,
 votes:Math.min(votes,c.VOTE_CAP)*c.VOTE_INC,awards:Math.min(awards.filter(isScoringAward).length,c.AWARD_CAP)*c.AWARD_INC};
 const merit=Object.values(breakdown).reduce((a,b)=>a+b,0);
 const performance=merit-ownGoals*c.OWN_GOAL_DEC;
 const previous=match.previousPerformance?.[playerId];
 const improved=Number.isFinite(previous)&&performance>previous+1e-9;
 const improvementMerit=improved?c.IMPROVEMENT_INC:0;
 const improvementBonus=progressiveRating(merit+improvementMerit)-progressiveRating(merit);
 const captainLoss=match.captains?.[p.team]===playerId&&teamGoals<rivalGoals?c.CAPTAIN_LOSS_DEC:0;
 const ownGoalPenalty=ownGoals*c.OWN_GOAL_DEC;
 const rating=Math.min(c.MAX,Math.max(c.MIN,progressiveRating(merit+improvementMerit)-ownGoalPenalty-captainLoss));
 return {rating,goals,assists,ownGoals,votes,awards,win,cleanSheet,teamGoals,rivalGoals,
 merit,performance,breakdown,improved,improvementMerit,improvementBonus,captainLoss,ownGoalPenalty};
}
// Contexto derivado, nunca guardado: se reconstruye al cambiar partidos o votos.
export function withRatingHistory(matches,votes={}) {
 const history=new Map(),result=new Map();
 for(const m of [...matches].sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.id).localeCompare(String(b.id)))) {
  const copy={...m};delete copy.previousPerformance;
  Object.defineProperty(copy,'previousPerformance',{value:Object.fromEntries(history),enumerable:false});
  result.set(m,copy);
  if(isOfficialMode(m.mode)) for(const part of m.participants) history.set(part.playerId,computeMatchRating(copy,part.playerId,votes[m.id]).performance);
 }
 return matches.map(m=>result.get(m));
}
