import {createServer as createHttpServer} from 'node:http';
import {createServer as createViteServer, loadEnv} from 'vite';
import club from '../api/club.js';
for(const [key,value] of Object.entries(loadEnv('development',process.cwd(),'')))if(process.env[key]===undefined)process.env[key]=value;
process.env.NODE_ENV ||= 'development';
let vite;
const server=createHttpServer(async(req,res)=>{
 const url=new URL(req.url,'http://'+req.headers.host);
 if(url.pathname==='/api/club'){
  res.status=n=>{res.statusCode=n;return res;};res.json=v=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(v));};
  req.query=Object.fromEntries(url.searchParams);
  try{
   if(req.method==='POST'){
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>950000){res.status(413).json({error:'La solicitud es demasiado grande.'});return;}chunks.push(chunk);}
    req.body=Buffer.concat(chunks).toString('utf8');
   }
   await club(req,res);
  }catch{res.status(400).json({error:'No se pudo completar la solicitud.'});}
  return;
 }
 vite.middlewares(req,res,()=>{res.statusCode=404;res.end('Not found');});
});
vite=await createViteServer({server:{middlewareMode:true,hmr:{server}},appType:'spa'});
const port=Number(process.env.PORT)||5173;
server.listen(port,'127.0.0.1',()=>process.stdout.write(`Mercenarios FC: http://127.0.0.1:${port}\n`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await vite.close();server.close(()=>process.exit(0));});
