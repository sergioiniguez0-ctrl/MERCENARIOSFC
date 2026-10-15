export const MAGAZINE_KEY='magazine';
export const LIMITS={title:120,deck:600,body:20000,protagonist:60,date:10,number:20,matchId:180};
export function validateEditions(value){
 if(!Array.isArray(value)||value.length>100)throw new Error('Se admiten hasta 100 ediciones.');
 const ids=new Set();
 for(const e of value){
  if(!e||typeof e.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(e.id)||ids.has(e.id))throw new Error('Edición inválida.');ids.add(e.id);
  if(!['draft','published'].includes(e.status))throw new Error('Estado inválido.');
  for(const [key,max] of Object.entries(LIMITS))if(typeof e[key]!=='string'||e[key].length>max)throw new Error(`Revisá el campo ${key}.`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||Number.isNaN(Date.parse(e.date+'T12:00:00Z'))||new Date(e.date+'T12:00:00Z').toISOString().slice(0,10)!==e.date)throw new Error('Fecha inválida.');
  if(!Array.isArray(e.notes)||e.notes.length>10)throw new Error('Revisá las notas.');
  for(const n of e.notes)if(!n||!['Perfil','Nota de color','Destacado'].includes(n.type)||typeof n.title!=='string'||n.title.length>120||typeof n.body!=='string'||n.body.length>10000)throw new Error('Nota inválida.');
  if(e.status==='published'&&(!e.title.trim()||!e.body.trim()||!e.protagonist.trim()))throw new Error('Para publicar completá titular, protagonista y crónica.');
 }
 if(JSON.stringify(value).length>750000)throw new Error('El archivo de ediciones está lleno.');
 return value;
}
export function parseEditorial(text){
 const labels={TITULAR:'title',BAJADA:'deck',PROTAGONISTA:'protagonist',CRONICA:'body','CRÓNICA':'body'};
 const result={};let key=null;
 for(const line of text.split(/\r?\n/)){const match=line.match(/^\s*(TITULAR|BAJADA|PROTAGONISTA|CR[ÓO]NICA)\s*:\s*(.*)$/i);if(match){key=labels[match[1].toUpperCase()];if(result[key]!==undefined)throw new Error('Hay campos repetidos en el texto.');result[key]=match[2];}else if(key)result[key]+='\n'+line;else if(line.trim())throw new Error('Usá los encabezados TITULAR:, BAJADA:, PROTAGONISTA: y CRÓNICA:.');}
 if(!result.title||!result.body)throw new Error('Faltan TITULAR: o CRÓNICA:.');
 for(const k of Object.keys(result)){result[k]=result[k].trim();if(result[k].length>LIMITS[k])throw new Error(`El campo ${k} supera el límite.`);}
 return result;
}
