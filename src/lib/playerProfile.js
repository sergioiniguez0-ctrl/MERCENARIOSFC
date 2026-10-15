import { AVATAR_IDS } from './avatarCatalog.js';
export { AVATAR_IDS } from './avatarCatalog.js';
export const MAX_PLAYERS = 50;
export const MAX_DORSAL = 99;
export const PROFILE_COLORS = ['#0D6EFD', '#922b45', '#15803d', '#7c3aed', '#b45309', '#475569'];
export const PROFILE_POSITIONS = ['ARQ', 'DFC', 'LAT', 'VOD', 'VOF', 'DC', 'EXT', 'DEF', 'MED', 'DEL'];
export const PROFILE_FIELDS = ['nickname', 'age', 'number', 'avatarId', 'position', 'secondaryPosition', 'dominantFoot', 'bio', 'profileColor'];
export function availableNumbers(players, playerId) {
  const used = new Set(players.filter(p=>p.id!==playerId).map(p=>Number(p.number)));
  return Array.from({length:MAX_DORSAL},(_,i)=>i+1).filter(n=>!used.has(n));
}
export function normalizeProfile(input, players, id, {admin=false}={}) {
  const out = {};
  const allowed = admin ? [...PROFILE_FIELDS, 'name'] : PROFILE_FIELDS;
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) throw new Error('Ese campo no se puede editar desde el perfil.');
  }
  if ('name' in input) {
    if (typeof input.name!=='string' || !input.name.trim() || input.name.trim().length>60) throw new Error('El nombre debe tener entre 1 y 60 caracteres.');
    out.name = input.name.trim();
  }
  for (const [key,max] of [['nickname',24],['bio',120]]) if (key in input) {
    if (typeof input[key]!=='string' || input[key].trim().length>max) throw new Error(`${key==='bio'?'La frase':'El apodo'} admite hasta ${max} caracteres.`);
    out[key]=input[key].trim();
  }
  if ('number' in input) {
    const n=Number(input.number);
    if (!Number.isInteger(n)||n<1||n>MAX_DORSAL) throw new Error('Elegí un dorsal del 1 al 99.');
    if (players.some(p=>p.id!==id&&Number(p.number)===n)) throw new Error(`El dorsal #${n} ya está ocupado.`);
    out.number=n;
  }
  if ('age' in input) {
    const n=input.age===''||input.age==null?null:Number(input.age);
    if(n!==null&&(!Number.isInteger(n)||n<5||n>99)) throw new Error('La edad debe estar entre 5 y 99 años.');
    out.age=n;
  }
  for(const key of ['position','secondaryPosition']) if(key in input){
    if(key==='secondaryPosition'&&!input[key])out[key]='';
    else if(!PROFILE_POSITIONS.includes(input[key]))throw new Error('La posición no es válida.');
    else out[key]=input[key];
  }
  if('dominantFoot' in input){if(!['','Derecho','Izquierdo','Ambidiestro'].includes(input.dominantFoot))throw new Error('Elegí un pie dominante válido.');out.dominantFoot=input.dominantFoot;}
  if('profileColor' in input){if(!PROFILE_COLORS.includes(input.profileColor))throw new Error('Elegí uno de los colores disponibles.');out.profileColor=input.profileColor;}
  if('avatarId' in input){if(!AVATAR_IDS.includes(input.avatarId))throw new Error('Elegí un avatar disponible.');out.avatarId=input.avatarId;}
  return out;
}
export function assertRoster(players) {
  if(!Array.isArray(players)||players.length>MAX_PLAYERS)throw new Error('El plantel admite hasta 50 jugadores.');
  const ids=new Set(), numbers=new Set();
  for(const p of players){
    if(!p.id||typeof p.id!=='string'||ids.has(p.id))throw new Error('Hay un identificador de jugador duplicado.');
    if(!p.name||typeof p.name!=='string'||p.name.length>60)throw new Error('El nombre del jugador no es válido.');
    const n=Number(p.number);
    if(!Number.isInteger(n)||n<1||n>MAX_DORSAL||numbers.has(n))throw new Error('Los dorsales deben ser únicos, del 1 al 99.');
    ids.add(p.id);numbers.add(n);
  }
  return players;
}
export function displayName(player) {return player?.nickname || player?.name || 'Jugador';}
export function repairRosterNumbers(players){
 if(players.length>MAX_PLAYERS)throw new Error('El plantel supera los 50 jugadores. Revisalo antes de cambiar dorsales.');
 const occupied=new Set(),pending=[];
 const next=players.map(p=>{const number=Number(p.number);if(Number.isInteger(number)&&number>=1&&number<=MAX_DORSAL&&!occupied.has(number)){occupied.add(number);return {...p,number};}const copy={...p};pending.push(copy);return copy;});
 const changes=[];
 for(const p of pending){let n=1;while(occupied.has(n))n++;occupied.add(n);changes.push({id:p.id,name:p.name,old:p.number??null,number:n});p.number=n;}
 assertRoster(next);return {players:next,changes};
}
