import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch();const page=await browser.newPage({serviceWorkers:'block'});
await page.goto('http://127.0.0.1:4191/dist/pwa/editor.html');await page.waitForFunction(()=>document.querySelector('#editor').contentEditable==='true');
await page.evaluate(async()=>{
 const store=(await import('./src/core/workspace-store.js')).createWorkspaceStore();const ws=await store.readWorkspace();
 const original=ws.pages[0];ws.pages=Array.from({length:100},(_,i)=>({...original,id:'audit-'+i,position:i,content:i===0?Array(100).fill('Long note line').join('<br>'):'Other note '+i}));ws.currentPageId=ws.pages[0].id;await store.saveWorkspace(ws);
});
await page.reload();await page.waitForFunction(()=>document.querySelector('#editor').contentEditable==='true');await page.waitForTimeout(500);
await page.evaluate(()=>{window.auditWrites=[];const orig=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...rest){window.auditWrites.push({store:this.name,id:value.id,key:value.key});return orig.call(this,value,...rest);};document.body.scrollTop=300;});
await page.waitForTimeout(650);
const data=await page.evaluate(()=>({scrollTop:document.body.scrollTop,pageRecordsWritten:window.auditWrites.filter(x=>x.store==='pages').length,metaRecordsWritten:window.auditWrites.filter(x=>x.store==='meta').length,uniquePageIds:new Set(window.auditWrites.filter(x=>x.store==='pages').map(x=>x.id)).size}));
await writeFile('docs/audits/2026-10-04/evidence/scroll-writes.json',JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data));await browser.close();
