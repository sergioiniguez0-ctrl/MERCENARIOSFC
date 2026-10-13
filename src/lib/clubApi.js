const versions=new Map();
export async function clubApi(action,data={},method='POST'){
 const query=new URLSearchParams({action,...(method==='GET'?data:{})});
 let response;
 try{response=await fetch('/api/club'+(method==='GET'?'?'+query:''),{method,credentials:'same-origin',headers:method==='POST'?{'Content-Type':'application/json'}:undefined,body:method==='POST'?JSON.stringify({action,...data}):undefined});}catch{throw new Error('No se pudo conectar. Revisá tu conexión e intentá de nuevo.');}
 let result;try{result=await response.json();}catch{throw new Error('El acceso del club todavía no está configurado.');}
 if(!response.ok)throw new Error(result.error||'No se pudo completar la operación.');
 if(result.key&&result.revision!==undefined)versions.set(result.key,result.revision);
 return result;
}
export const clubStorage={
 async get(key,shared=false){if(!shared)return {key,value:localStorage.getItem('club_'+key),shared};return clubApi('get',{key},'GET');},
 async set(key,value,shared=false){if(!shared){localStorage.setItem('club_'+key,value);return {key,value,shared};}if(!versions.has(key))await this.get(key,true);return clubApi('set',{key,value,revision:versions.get(key)});},
 async delete(key,shared=false){if(!shared){localStorage.removeItem('club_'+key);return {deleted:true};}return clubApi('delete',{key});},
 async list(prefix='',shared=false){return shared?clubApi('list',{prefix},'GET'):{keys:[]};},
};
