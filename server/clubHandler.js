import {randomInt, randomUUID, createHash} from 'node:crypto';
import {hashPin,verifyPin,validPin,constantEqual,signSession,readSession} from './security.js';
import {normalizeProfile,assertRoster,MAX_PLAYERS,availableNumbers,repairRosterNumbers} from '../src/lib/playerProfile.js';
import {validatePreview} from '../src/lib/teamBalancer.js';
import {RECOGNITIONS,eligibleForAward,awardBallotKey,ballotLeaders} from '../src/lib/recognitions.js';
import {validateEditions} from '../src/lib/magazine.js';
const PUBLIC_KEYS=['players','matches','votes','upcomingMatchday','magazine'];
const MISSION_PREFIX='missionAssignment:';
const error=(message,status=400)=>Object.assign(new Error(message),{status});
const safeKey=key=>typeof key==='string'&&/^[a-zA-Z0-9_:-]{1,180}$/.test(key);
const parse=snap=>snap.exists?JSON.parse(snap.data().value):null;
const revision=snap=>snap.exists?(snap.data().revision||0):0;
const publicKey=key=>PUBLIC_KEYS.includes(key)||/^awardBallots_[a-zA-Z0-9_-]+$/.test(key)||/^attendance_[a-zA-Z0-9_-]+$/.test(key);
export function createClubHandler({db,env=process.env,now=()=>Date.now()}){
 const storage=db.collection('mercenarios').doc('shared').collection('storage');
 const credentials=db.collection('clubCredentials');
 async function session(req){
  const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('club_session='))?.slice(13);
  const data=readSession(token,env.CLUB_SESSION_SECRET,now());
  if(data?.role==='player'){
   const c=await credentials.doc(data.playerId).get();
   if(!c.exists||c.data().version!==data.version)return null;
  }
  return data;
 }
 function cookie(res,data){
  const value=data?signSession(data,env.CLUB_SESSION_SECRET,now()):'';
  res.setHeader('Set-Cookie',`club_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${data?(data.role==='admin'?28800:604800):0}${env.NODE_ENV==='production'?'; Secure':''}`);
 }
 const requireAdmin=s=>{if(s?.role!=='admin')throw error('Esta acción corresponde al administrador.',403);};
 const requirePlayer=s=>{if(s?.role!=='player')throw error('Ingresá con tu nombre y PIN.',401);};
 async function throttle(req,account){
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  const names=[['ip:'+ip,80],['account:'+account,10]];
  await db.runTransaction(async tx=>{
   const refs=names.map(([id])=>db.collection('clubLoginLimits').doc(createHash('sha256').update(id).digest('hex')));
   const snaps=await Promise.all(refs.map(r=>tx.get(r)));
   const values=snaps.map(s=>s.exists?s.data():{});
   for(let i=0;i<refs.length;i++)if(values[i].until>now()&&values[i].count>=names[i][1])throw error('Demasiados intentos. Esperá 15 minutos antes de volver a ingresar.',429);
   for(let i=0;i<refs.length;i++){const active=values[i].until>now();tx.set(refs[i],{count:active?values[i].count+1:1,until:active?values[i].until:now()+900000});}
  });
 }
 async function mutate(key,fn){
  const ref=storage.doc(key);
  return db.runTransaction(async tx=>{
   const snap=await tx.get(ref);const result=await fn(parse(snap),tx);
   const rev=revision(snap)+1;tx.set(ref,{value:JSON.stringify(result),revision:rev,updatedAt:now()});return {value:JSON.stringify(result),revision:rev,key,shared:true};
  });
 }
 function accessKey(key,s){
  if(!safeKey(key))throw error('Clave inválida.');
  if(publicKey(key))return;
  if(key.startsWith(MISSION_PREFIX)&&(s?.role==='admin'||(s?.role==='player'&&key.endsWith('_'+s.playerId))))return;
  throw error('No tenés acceso a ese registro.',403);
 }
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  try{
   if(!env.CLUB_SESSION_SECRET||env.CLUB_SESSION_SECRET.length<32)throw error('Falta activar el acceso del club en el servidor.',503);
   if(!['GET','POST'].includes(req.method))throw error('Método no permitido.',405);
   let body={};
   if(req.method==='POST'){
    const origin=req.headers.origin;const host=req.headers.host;
    if(origin&&origin!==(env.CLUB_ORIGIN||`https://${host}`)&&!(env.NODE_ENV!=='production'&&origin===`http://${host}`))throw error('Origen no permitido.',403);
    if(!(req.headers['content-type']||'').startsWith('application/json'))throw error('Formato no permitido.',415);
    body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
    if(JSON.stringify(body).length>900000)throw error('La solicitud es demasiado grande.',413);
   }
   const action=req.method==='GET'?req.query?.action:body.action;
   const s=await session(req);
   const requirePost=()=>{if(req.method!=='POST')throw error('Esta acción necesita POST.',405);};
   if(action==='session')return res.status(200).json({session:s?{role:s.role,playerId:s.playerId||null}:null});
   if(action==='logout'){requirePost();cookie(res,null);return res.status(200).json({ok:true});}
   if(action==='login'){
    requirePost();const id=String(body.playerId||'');if(!safeKey(id))throw error('Seleccioná tu nombre.');
    await throttle(req,id);
    const credential=await credentials.doc(id).get();
    if(!credential.exists||!await verifyPin(body.pin,credential.data()))throw error('Nombre o PIN incorrectos. Pedile al administrador tu PIN si todavía no tenés uno.',401);
    const roster=parse(await storage.doc('players').get())||[];if(!roster.some(p=>p.id===id))throw error('Nombre o PIN incorrectos.',401);
    cookie(res,{role:'player',playerId:id,version:credential.data().version});return res.status(200).json({session:{role:'player',playerId:id}});
   }
   if(action==='adminLogin'){
    requirePost();await throttle(req,'admin');
    if(!env.CLUB_ADMIN_PASSWORD||env.CLUB_ADMIN_PASSWORD.length<12)throw error('Falta configurar la contraseña de administrador.',503);
    if(!constantEqual(body.user,env.CLUB_ADMIN_USER||'admin')||!constantEqual(body.password,env.CLUB_ADMIN_PASSWORD))throw error('Usuario o contraseña incorrectos.',401);
    cookie(res,{role:'admin'});return res.status(200).json({session:{role:'admin',playerId:null}});
   }
   if(action==='provisionPin'){
    requirePost();requireAdmin(s);const id=body.playerId;if(!safeKey(id))throw error('Jugador inválido.');
    const roster=parse(await storage.doc('players').get())||[];if(!roster.some(p=>p.id===id))throw error('Jugador inexistente.');
    const pin=String(randomInt(0,1000000)).padStart(6,'0');const hashed=await hashPin(pin);
    await db.runTransaction(async tx=>{const ref=credentials.doc(id),old=await tx.get(ref);tx.set(ref,{...hashed,version:(old.exists?old.data().version:0)+1,updatedAt:now()});});
    return res.status(200).json({pin});
   }
   if(action==='changePin'){
    requirePost();requirePlayer(s);if(!validPin(body.newPin))throw error('El PIN debe tener 6 dígitos.');
    await throttle(req,s.playerId);
    const old=await credentials.doc(s.playerId).get();if(!await verifyPin(body.oldPin,old.data()))throw error('El PIN actual es incorrecto.',401);
    const hashed=await hashPin(body.newPin);
    const version=await db.runTransaction(async tx=>{const ref=credentials.doc(s.playerId),latest=await tx.get(ref);if(latest.data().version!==s.version)throw error('Tu sesión venció. Volvé a ingresar.',401);const v=s.version+1;tx.set(ref,{...hashed,version:v,updatedAt:now()});return v;});
    cookie(res,{role:'player',playerId:s.playerId,version});return res.status(200).json({ok:true});
   }
   if(action==='profile'){
    requirePost();if(!s)throw error('Ingresá con tu PIN.',401);
    const id=s.role==='admin'?body.playerId:s.playerId;
    if(s.role!=='admin'&&body.playerId&&body.playerId!==s.playerId)throw error('Solo podés editar tu perfil.',403);
    const result=await mutate('players',players=>{const list=players||[];if(!list.some(p=>p.id===id))throw error('Jugador inexistente.');const patch=normalizeProfile(body.profile||{},list,id,{admin:s.role==='admin'});return assertRoster(list.map(p=>p.id===id?{...p,...patch}:p));});
    return res.status(200).json(result);
   }
   if(action==='addPlayer'){
    requirePost();requireAdmin(s);
    const result=await mutate('players',players=>{const list=players||[];if(list.length>=MAX_PLAYERS)throw error('Ya hay 50 jugadores cargados.');const id='p'+randomUUID().replaceAll('-','');const profile={...body.profile,number:body.profile.number||availableNumbers(list)[0]};const patch=normalizeProfile(profile,list,id,{admin:true});if(!patch.name||!patch.position)throw error('Completá nombre y posición.');return assertRoster([...list,{id,...patch}]);});
    return res.status(200).json(result);
   }
   if(action==='repairNumbers'){
    requirePost();requireAdmin(s);const ref=storage.doc('players');
    const result=await db.runTransaction(async tx=>{const snap=await tx.get(ref),players=parse(snap)||[];const proposal=repairRosterNumbers(players);
     if(!body.confirm)return {...proposal,revision:revision(snap)};
     if(body.revision!==revision(snap))throw error('El plantel cambió. Revisá de nuevo la propuesta.',409);
     const rev=revision(snap)+1;tx.set(ref,{value:JSON.stringify(proposal.players),revision:rev,updatedAt:now()});return {key:'players',value:JSON.stringify(proposal.players),revision:rev,changes:proposal.changes,shared:true};});return res.status(200).json(result);
   }
   if(action==='deletePlayer'){
    requirePost();requireAdmin(s);const id=body.playerId;
    const result=await mutate('players',players=>{const target=players?.find(p=>p.id===id);if(!target)throw error('Jugador inexistente.');if(target.name.trim().toLowerCase().replace(/\s+/g,' ')==='cris 8')throw error('Cris 8 no se puede eliminar.');return players.filter(p=>p.id!==id);});
    if(safeKey(id))await credentials.doc(id).delete();return res.status(200).json(result);
   }
   if(action==='closeVoting'||action==='reopenVoting'){
    requirePost();requireAdmin(s);const id=body.matchId;if(!safeKey(id))throw error('Partido inválido.');
    const result=await db.runTransaction(async tx=>{
     const ref=storage.doc('matches'),snap=await tx.get(ref),matches=parse(snap)||[];
     const match=matches.find(m=>m.id===id);if(!match)throw error('Partido inexistente.');
     const ballots=action==='closeVoting'?(parse(await tx.get(storage.doc(awardBallotKey(id))))||{}):{};
     const elected=action==='closeVoting'?RECOGNITIONS.flatMap(c=>ballotLeaders(ballots,c.id).filter(w=>eligibleForAward(match,c.id).includes(w.playerId)).map(w=>({label:c.label,playerId:w.playerId,countsForRating:false,source:'vote',votes:w.votes}))):[];
     const next=matches.map(m=>m.id===id?{...m,votingOpen:action==='reopenVoting',awards:[...(m.awards||[]).filter(a=>a.source!=='vote'),...elected]}:m);
     const rev=revision(snap)+1;tx.set(ref,{value:JSON.stringify(next),revision:rev,updatedAt:now()});return {key:'matches',value:JSON.stringify(next),revision:rev,shared:true};
    });return res.status(200).json(result);
   }
   if(action==='vote'||action==='awardVote'){
    requirePost();requirePlayer(s);const id=body.matchId;if(!safeKey(id))throw error('Partido inválido.');
    const result=await db.runTransaction(async tx=>{
     const matches=parse(await tx.get(storage.doc('matches')))||[];
     const match=matches.find(m=>m.id===id);if(!match?.votingOpen)throw error('La votación está cerrada.');
     if(!match.participants.some(p=>p.playerId===s.playerId))throw error('Solo votan los participantes de esta fecha.',403);
     const key=action==='vote'?'votes':awardBallotKey(id),ref=storage.doc(key),snap=await tx.get(ref);const values=parse(snap)||{};
     if(action==='vote'){
      if(!match.participants.some(p=>p.playerId===body.candidate))throw error('El candidato no jugó esta fecha.');
      if(values[id]?.[s.playerId])throw error('Ya votaste en este partido.');values[id]={...values[id],[s.playerId]:body.candidate};
     }else{
      if(!RECOGNITIONS.some(c=>c.id===body.category)||!eligibleForAward(match,body.category).includes(body.candidate))throw error('Ese jugador no es elegible para el reconocimiento.');
      if(values[s.playerId]?.[body.category])throw error('Ya votaste esta categoría.');values[s.playerId]={...values[s.playerId],[body.category]:body.candidate};
     }
     const rev=revision(snap)+1;tx.set(ref,{value:JSON.stringify(values),revision:rev,updatedAt:now()});return {value:JSON.stringify(values),revision:rev,key,shared:true};
    });return res.status(200).json(result);
   }
   if(action==='attendance'){
    requirePost();requirePlayer(s);if(!['yes','no','maybe'].includes(body.status))throw error('Elegí una respuesta válida.');
    const result=await db.runTransaction(async tx=>{
     const draft=parse(await tx.get(storage.doc('upcomingMatchday')));
     if(!draft||draft.id!==body.matchId)throw error('La convocatoria cambió. Actualizá la previa.');
     const roster=parse(await tx.get(storage.doc('players')))||[];if(!roster.some(p=>p.id===s.playerId))throw error('Jugador inexistente.');
     const key='attendance_'+draft.id,ref=storage.doc(key),snap=await tx.get(ref),values=parse(snap)||{};values[s.playerId]=body.status;const rev=revision(snap)+1;
     tx.set(ref,{value:JSON.stringify(values),revision:rev,updatedAt:now()});return {value:JSON.stringify(values),revision:rev,key,shared:true};
    });return res.status(200).json(result);
   }
   if(action==='get'){
    const key=req.query.key;accessKey(key,s);const snap=await storage.doc(key).get();let value=snap.exists?snap.data().value:null;if(key==='magazine'&&s?.role!=='admin'&&value)value=JSON.stringify(JSON.parse(value).filter(e=>e.status==='published'));return res.status(200).json({key,value,revision:revision(snap),shared:true});
   }
   if(action==='list'){
    const prefix=req.query.prefix||'';
    if(prefix!==MISSION_PREFIX)throw error('Listado no disponible.',403);
    const snaps=await storage.get();const keys=snaps.docs.map(d=>d.id).filter(k=>k.startsWith(prefix)&&(s?.role==='admin'||(s?.role==='player'&&k.endsWith('_'+s.playerId))));return res.status(200).json({keys});
   }
   if(action==='set'||action==='delete'){
    requirePost();requireAdmin(s);const key=body.key;accessKey(key,s);
    if(!PUBLIC_KEYS.includes(key)&&!key.startsWith(MISSION_PREFIX))throw error('Registro de solo lectura.',403);
    if(key==='players')throw error('Usá la edición de jugadores para preservar los cambios de cada perfil.');
    if(action==='delete'){
     if(key!=='upcomingMatchday')throw error('No se puede borrar ese registro.');
     await storage.doc(key).delete();return res.status(200).json({key,deleted:true});
    }
    const value=JSON.parse(body.value);
    if(key==='magazine')validateEditions(value);
    if(key==='upcomingMatchday')validatePreview(value,parse(await storage.doc('players').get())||[],!!value.confirmed);
    if(key==='matches'){
     if(!Array.isArray(value))throw error('Partidos inválidos.');
     for(const m of value){if(!safeKey(m.id)||!Array.isArray(m.participants)||!m.date||!m.mode)throw error('Revisá los datos del partido.');const ids=m.participants.map(p=>p.playerId);if(new Set(ids).size!==ids.length||(m.awards||[]).some(a=>!ids.includes(a.playerId)))throw error('Los participantes y reconocimientos del partido no son válidos.');}
    }
    const ref=storage.doc(key);
    const result=await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(body.revision!==revision(snap))throw error('Los datos cambiaron. Actualizá y volvé a guardar.',409);const rev=revision(snap)+1;tx.set(ref,{value:JSON.stringify(value),revision:rev,updatedAt:now()});return {key,value:JSON.stringify(value),revision:rev,shared:true};});
    return res.status(200).json(result);
   }
   throw error('Acción no disponible.',404);
  }catch(e){const status=e.status||400;res.status(status).json({error:status>=500?'Falta activar el acceso del club en el servidor.':e.message||'No se pudo completar la operación.'});}
 };
}
