// In-memory copy of Netlify Blobs with the same "onlyIfMatch / onlyIfNew" rules and random delays, to provoke races.
const stores=new Map(); let n=0;
const d=()=>new Promise(r=>setTimeout(r,Math.random()*4));
export const getStore=({name})=>{ if(!stores.has(name))stores.set(name,new Map()); const m=stores.get(name);
 const put=async(k,v,o={})=>{ await d(); const cur=m.get(k); if(o.onlyIfNew&&cur)return {modified:false}; if(o.onlyIfMatch&&(!cur||cur.etag!==o.onlyIfMatch))return {modified:false}; m.set(k,{v:String(v),etag:"e"+(++n)}); return {modified:true}; };
 return {
 async get(k,o){ await d(); const e=m.get(k); if(!e)return null; return o&&o.type==="json"?JSON.parse(e.v):e.v; },
 async getWithMetadata(k,o){ await d(); const e=m.get(k); if(!e)return null; return {data:o&&o.type==="json"?JSON.parse(e.v):e.v, etag:e.etag, metadata:{}}; },
 set:(k,v,o)=>put(k,v,o), setJSON:(k,v,o)=>put(k,JSON.stringify(v),o), async delete(k){m.delete(k)},
 list({prefix=""}={}){ const keys=[...m.keys()].filter(k=>k.startsWith(prefix)); return (async function*(){ yield {blobs:keys.map(key=>({key}))}; })(); }}};
export const raw={get:(name)=>({get:(k)=>stores.get(name)?.get(k)?.v, values:()=>[...(stores.get(name)||new Map()).values()].map(e=>e.v)})};
