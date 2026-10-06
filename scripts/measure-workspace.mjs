import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.env.BLACKBOARD_TEST_URL || 'http://127.0.0.1:4189/dist/pwa/';
const browser=await chromium.launch();
const context=await browser.newContext({serviceWorkers:'block'});
const page=await context.newPage();
await page.goto(base+'editor.html');
const measurements=await page.evaluate(async()=>{
  const {createWorkspaceStore}=await import('./src/core/workspace-store.js');
  const records=[];
  for(const count of [100,1000]) {
    const store=createWorkspaceStore({dbName:'benchmark-'+crypto.randomUUID()});
    const pages=Array.from({length:count},(_,i)=>({id:'p'+i,title:'Page '+i,content:'A note with several lines. '.repeat(100),drawings:[]}));
    const workspace={pages,currentPageId:'p0',settings:{fontSize:40}};
    const start=performance.now();await store.saveWorkspace(workspace);const written=performance.now();await store.readWorkspace();
    records.push({pages:count,bytes:new Blob([JSON.stringify(workspace)]).size,writeMs:Math.round(written-start),readMs:Math.round(performance.now()-written)});
  }
  const {canvasBackingSize}=await import('./src/core/canvas-budget.js');
  const canvas=document.createElement('canvas');Object.assign(canvas,canvasBackingSize(1440,900,2));const ctx=canvas.getContext('2d');
  for(const count of [10000,100000]) {
    const start=performance.now();ctx.beginPath();ctx.moveTo(0,0);for(let i=0;i<count;i++)ctx.lineTo(i%1440,(i*7)%900);ctx.stroke();
    records.push({strokePoints:count,pathMs:Math.round(performance.now()-start)});
  }
  return {measurements:records,heap:performance.memory?.usedJSHeapSize ?? null,userAgent:navigator.userAgent,canvasBudget:canvasBackingSize(1440,100000,3)};
});
await mkdir('docs/audits/2026-09-18/verification',{recursive:true});
await writeFile('docs/audits/2026-09-18/verification/performance.json',JSON.stringify(measurements,null,2)+'\n');
console.log(JSON.stringify(measurements));
await context.close();await browser.close();
