process.env.SD_VAULT_KEY="test-vault-key-0123456789abcdef";
import admin from "./netlify/functions/sd-admin.mjs";
import partnerApi from "./netlify/functions/sd-partner.mjs";
import client from "./netlify/functions/sd-client.mjs";
import * as core from "./netlify/lib/core.mjs";
import { raw } from "./netlify/lib/mock.mjs";
const call=async(fn,user,body)=>{const r=await fn(new Request("https://swandesk-ai.netlify.app/.netlify/functions/x",{method:"POST",headers:{"x-test-user":user||"","content-type":"application/json"},body:JSON.stringify(body)}));return {status:r.status, body:await r.json().catch(()=>null)}};
const ADMIN="thewebswann@gmail.com"; let pass=0, fail=0; const check=(name,ok,detail="")=>{ ok?pass++:fail++; console.log((ok?"PASS ":"FAIL ")+name+(detail?"  ["+detail+"]":"")); };

// Setup: CEO's own client + two partners
await call(admin,ADMIN,{action:"create",business:"WebSwan own client",emails:"own@webswan.test",agents:["jennifer","eva"]});
for (const [n,e] of [["Partner A","a@partnera.test"],["Partner B","b@partnerb.test"]]) await call(admin,ADMIN,{action:"partner_save",partner:{name:n,admins:e,edition:"voice",maxClients:2,status:"pilot"}});
const L=(await call(admin,ADMIN,{action:"list"})).body; const pA=L.partners.find(p=>p.name==="Partner A"), pB=L.partners.find(p=>p.name==="Partner B");

// 1. Workspace limits enforced on the server (API called directly, no page)
const c1=await call(partnerApi,"a@partnera.test",{action:"create",business:"A Dr 1",emails:"d1@a.test",agents:["jennifer","eva"]});
await call(partnerApi,"a@partnera.test",{action:"create",business:"A Dr 2",emails:"d2@a.test"});
const c3=await call(partnerApi,"a@partnera.test",{action:"create",business:"A Dr 3",emails:"d3@a.test"});
check("Workspace limit enforced by server (3rd of 2 refused)", c3.status===403, c3.body.error);
check("Voice Edition: partner cannot switch on Eva at creation", c1.body.client.agents.eva==="locked");
const idA=c1.body.client.id;
const bClient=(await call(partnerApi,"b@partnerb.test",{action:"create",business:"B Lawyer",emails:"l1@b.test"})).body.client;

// 2. Isolation: Partner B tries to read/change Partner A's customer by ID
check("B's list does not contain A's customers", !(await call(partnerApi,"b@partnerb.test",{action:"me"})).body.clients.some(c=>c.id===idA));
for (const a of [{action:"update",id:idA,business:"HACKED"},{action:"agent",id:idA,agent:"jennifer",state:"locked"},{action:"account",id:idA,on:false},{action:"update",id:idA,emails:"attacker@b.test"}]) {
  const r=await call(partnerApi,"b@partnerb.test",a); check(`B cannot ${a.action} A's customer by ID`, r.status===404, r.body.error); }
const own=L.clients.find(c=>c.business==="WebSwan own client");
const r2=await call(partnerApi,"a@partnera.test",{action:"update",id:own.id,business:"HACKED"}); check("Partner cannot touch WebSwan's own client", r2.status===404);
const r3=await call(partnerApi,"b@partnerb.test",{action:"me",as:pA.id}); check("Partner cannot open another partner's portal with ?as=", !r3.body.clients.some(c=>c.id===idA) && r3.body.partner.name==="Partner B");
const r4=await call(admin,"a@partnera.test",{action:"list"}); check("Partner cannot call the WebSwan admin API", r4.status===403);
const r5=await call(partnerApi,"own@webswan.test",{action:"me"}); check("A client cannot open the partner portal", r5.status===403);
const r6=await call(partnerApi,"",{action:"me"}); check("Not signed in = refused", r6.status===401);
const r7=await call(client,"d1@a.test",{action:"me",as:own.id}); check("Client cannot view another workspace with ?as=", r7.body.workspace.business==="A Dr 1");
const r8=await call(partnerApi,"b@partnerb.test",{action:"create",business:"Steal",emails:"d1@a.test"}); check("Partner cannot take over another customer's sign-in email", r8.status===400);
check("Partner page responses contain no WebSwan prices or costs", !JSON.stringify((await call(partnerApi,"a@partnera.test",{action:"me"})).body).match(/monthlyFee|licenseFee|cost|margin|hostingFee|perClientAfter/));
check("Voice Edition client sees Jennifer only", Object.keys((await call(client,"d1@a.test",{action:"me"})).body.workspace.agents).join()==="jennifer");

// 3. Credentials: encrypted at rest, never returned, revocable
await call(partnerApi,"a@partnera.test",{action:"vault_save",vault:{phone:{provider:"RingCentral",account:"acct-1",secret:"SUPERSECRET-TOKEN-9876"}}});
const stored=raw.get("swandesk").get("vault-"+pA.id);
check("Key stored encrypted (plain text not in database)", !stored.includes("SUPERSECRET"));
const me=JSON.stringify((await call(partnerApi,"a@partnera.test",{action:"me"})).body);
check("Key never sent back to the browser (only last 4)", !me.includes("SUPERSECRET") && me.includes("••••9876"));
check("Audit log does not contain the key", ![...raw.get("swandesk").values()].some(v=>v.includes("SUPERSECRET-TOKEN")&&!v.startsWith("{\"phone")) );
check("Partner B cannot see Partner A's keys", !JSON.stringify((await call(partnerApi,"b@partnerb.test",{action:"me"})).body).includes("9876"));
check("Key decrypts correctly for use", core.unseal(JSON.parse(stored).phone.secret)==="SUPERSECRET-TOKEN-9876");
await call(partnerApi,"a@partnera.test",{action:"vault_save",vault:{phone:{clear:true}}});
check("Key can be revoked (removed)", !raw.get("swandesk").get("vault-"+pA.id).includes("phone"));

// 4. Simultaneous updates
const burst=await Promise.all(Array.from({length:20},(_,i)=>call(partnerApi,"b@partnerb.test",{action:"create",business:"Burst "+i,emails:`x${i}@b.test`})));
const bCount=(await call(partnerApi,"b@partnerb.test",{action:"me"})).body.clients.length;
check("20 creates at the same moment cannot pass the license limit of 2", bCount===2, `Partner B has ${bCount} workspaces, ${burst.filter(r=>r.status===403).length} refused`);
const dup=await Promise.all(Array.from({length:10},(_,i)=>call(admin,ADMIN,{action:"create",business:"Dup "+i,emails:"same@t.test"})));
check("10 clients claiming the same email at once: only 1 gets it", dup.filter(r=>r.status===200).length===1);
const many=[]; for (let i=0;i<30;i++) many.push(call(admin,ADMIN,{action:"create",business:"Load "+i,emails:`load${i}@t.test`}));
await Promise.all(many);
const after=(await call(admin,ADMIN,{action:"list"})).body.clients;
check("30 clients created at the same moment: none lost", Array.from({length:30},(_,i)=>"Load "+i).every(n=>after.some(c=>c.business===n)), after.length+" clients total");
check("Every one of them can sign in (email index)", (await Promise.all(Array.from({length:30},(_,i)=>core.tenantForEmail(`load${i}@t.test`)))).every(Boolean));
// Same record, two changes at once
const tgt=after.find(c=>c.business==="Load 0");
await Promise.all([call(admin,ADMIN,{action:"agent",id:tgt.id,agent:"eva",state:"active"}),call(admin,ADMIN,{action:"agent",id:tgt.id,agent:"stan",state:"active"})]);
let t2=await core.tenant(tgt.id);
check("Two changes to the SAME client at the same moment both kept", t2.agents.eva.state==="active"&&t2.agents.stan.state==="active", `eva=${t2.agents.eva.state} rosie=${t2.agents.stan.state}`);
await Promise.all(["eva","stan","jonathan","jennifer"].flatMap(a=>[call(admin,ADMIN,{action:"agent",id:tgt.id,agent:a,state:"paused"}),call(client,"load0@t.test",{action:"me"})]));
t2=await core.tenant(tgt.id);
const hist=(await call(admin,ADMIN,{action:"audit",id:tgt.id})).body.log;
check("4 changes to the same client at once: all 4 kept", ["eva","stan","jonathan","jennifer"].every(a=>t2.agents[a].state==="paused"));
check("History (audit log) kept every change: none lost", hist.filter(l=>l.action==="agent").length===6, hist.filter(l=>l.action==="agent").length+" agent changes logged");

// 5. Backup and restore
const bk=(await call(admin,ADMIN,{action:"backup_now"})).body; check("Backup created and verified", bk.verified===true, bk.count+" records");
await call(admin,ADMIN,{action:"update",id:own.id,business:"Accidentally changed"});
const rs=await call(admin,ADMIN,{action:"backup_restore",key:bk.key,confirm:"RESTORE"});
check("Restore brings the record back", (await core.tenant(own.id)).business==="WebSwan own client", rs.body.restored+" records restored");
check("Restore took a safety backup first", (await call(admin,ADMIN,{action:"backup_list"})).body.backups.length===2);
check("Private data check: SwanDesk stores no WorkPilot, lead or Voice Studio data", ![...raw.get("swandesk").values()].some(v=>/workpilot|lead|prospect/i.test(v)));
check("Restore refuses without typing RESTORE", (await call(admin,ADMIN,{action:"backup_restore",key:bk.key})).status===400);
console.log(`\n${pass} passed, ${fail} failed`);
