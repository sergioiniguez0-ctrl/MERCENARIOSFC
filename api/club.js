import {getApps,initializeApp,cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {createClubHandler} from '../server/clubHandler.js';
let handler;
export default async function club(req,res){
 try{
  if(!handler){
   if(!process.env.FIREBASE_SERVICE_ACCOUNT)throw new Error('Missing configuration');
   const account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
   const app=getApps()[0]||initializeApp({credential:cert(account)});
   handler=createClubHandler({db:getFirestore(app)});
  }
  await handler(req,res);
 }catch{res.setHeader('Cache-Control','no-store');res.status(503).json({error:'Falta activar el acceso del club en el servidor.'});}
}
