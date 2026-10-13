import {createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual, createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCb);
export function validPin(pin){return typeof pin==='string'&&/^\d{6}$/.test(pin);}
export async function hashPin(pin){if(!validPin(pin))throw new Error('El PIN debe tener 6 dígitos.');const salt=randomBytes(16).toString('hex');const hash=(await scrypt(pin,salt,64)).toString('hex');return {salt,hash};}
export async function verifyPin(pin,credential){
 if(!validPin(pin)||!credential?.salt||!credential?.hash)return false;
 const actual=await scrypt(pin,credential.salt,64),expected=Buffer.from(credential.hash,'hex');
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export function constantEqual(a,b){const x=createHash('sha256').update(String(a)).digest(),y=createHash('sha256').update(String(b)).digest();return timingSafeEqual(x,y);}
export function signSession(data,secret,now=Date.now()){
 if(!secret||secret.length<32)throw new Error('Configuración de sesión pendiente.');
 const payload=Buffer.from(JSON.stringify({...data,exp:now+(data.role==='admin'?8*3600000:7*86400000)})).toString('base64url');
 return `${payload}.${createHmac('sha256',secret).update(payload).digest('base64url')}`;
}
export function readSession(token,secret,now=Date.now()){
 if(!secret||secret.length<32||typeof token!=='string')return null;
 const [payload,signature,...rest]=token.split('.');if(!payload||!signature||rest.length)return null;
 const expected=createHmac('sha256',secret).update(payload).digest('base64url');
 if(!constantEqual(signature,expected))return null;
 try{const data=JSON.parse(Buffer.from(payload,'base64url').toString());return Number.isFinite(data.exp)&&data.exp>now&&['admin','player'].includes(data.role)?data:null;}catch{return null;}
}
