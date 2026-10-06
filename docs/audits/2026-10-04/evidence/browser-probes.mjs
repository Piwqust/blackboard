import {chromium} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';
const out = new URL('./', import.meta.url);
await mkdir(out,{recursive:true});
const browser = await chromium.launch();
const findings = {};
const base='http://127.0.0.1:4191/dist/pwa/';
async function session(fn, options={}) {
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:900},deviceScaleFactor:2,...options});
 const page=await context.newPage();
 await page.goto(base+'editor.html');
 await page.waitForFunction(()=>document.querySelector('#editor').contentEditable==='true');
 try {return await fn(page);} finally {await context.close();}
}
async function tools(page) {
 await page.locator('#drawingToolbarVisibilityToggleBtn').click();
 await page.locator('#drawToggleBtn').click();
}
async function read(page) {
 return page.evaluate(async()=>await (await import('./src/core/workspace-store.js')).createWorkspaceStore().readWorkspace());
}
async function emit(page, events) {
 await page.evaluate(events=>{
  const canvas=document.querySelector('#drawingLayer');
  canvas.setPointerCapture=()=>{};canvas.releasePointerCapture=()=>{};
  for(const e of events) {
   const event=new PointerEvent(e.type,{bubbles:true,cancelable:true,button:0,buttons:1,pointerId:1,pointerType:'mouse',...e});
   if(e.coalesced) event.getCoalescedEvents=()=>e.coalesced;
   canvas.dispatchEvent(event);
  }
 },events);
 await page.waitForTimeout(250);
}
findings.endpoint=await session(async page=>{
 await tools(page);
 await emit(page,[{type:'pointerdown',clientX:200,clientY:200},{type:'pointermove',clientX:220,clientY:220},{type:'pointerup',clientX:280,clientY:260}]);
 const ws=await read(page);return {releasedAt:{x:280,y:260},stored:ws.pages[0].drawings[0].points};
});
findings.coalesced=await session(async page=>{
 await tools(page);
 await emit(page,[{type:'pointerdown',clientX:200,clientY:200},{type:'pointermove',clientX:240,clientY:240,coalesced:[{clientX:210,clientY:210},{clientX:220,clientY:215},{clientX:230,clientY:220}]},{type:'pointerup',clientX:240,clientY:240}]);
 return (await read(page)).pages[0].drawings[0];
});
findings.multiPointer=await session(async page=>{
 await tools(page);
 await emit(page,[{type:'pointerdown',pointerType:'pen',pointerId:7,clientX:200,clientY:200,pressure:0.2},{type:'pointermove',pointerType:'pen',pointerId:7,clientX:220,clientY:220,pressure:0.8},{type:'pointerdown',pointerType:'touch',pointerId:8,clientX:600,clientY:200},{type:'pointermove',pointerType:'pen',pointerId:7,clientX:250,clientY:230},{type:'pointermove',pointerType:'touch',pointerId:8,clientX:610,clientY:220},{type:'pointerup',pointerType:'pen',pointerId:7,clientX:260,clientY:240},{type:'pointerup',pointerType:'touch',pointerId:8,clientX:610,clientY:220}]);
 return (await read(page)).pages[0].drawings;
});
findings.scrollDuringStroke=await session(async page=>{
 await page.locator('#editor').fill(Array(100).fill('Long note line').join('\n'));
 await page.evaluate(()=>document.body.scrollTop=0);
 await page.waitForTimeout(150);
 await tools(page);
 await emit(page,[{type:'pointerdown',clientX:200,clientY:200}]);
 await page.evaluate(()=>document.body.scrollTop=400);
 const boardTop=await page.locator('#board').evaluate(el=>el.getBoundingClientRect().top);
 await emit(page,[{type:'pointermove',clientX:230,clientY:220},{type:'pointerup',clientX:230,clientY:220}]);
 return {boardTop,expectedY:220-boardTop,stored:(await read(page)).pages[0].drawings[0].points};
});
findings.canvasResolution=await session(async page=>{
 const result=[];
 for(const n of [1,100,400]) {
  await page.locator('#editor').fill(Array(n).fill('Long note line').join('\n'));
  await page.waitForTimeout(100);
  result.push(await page.evaluate(()=>{const c=document.querySelector('#drawingLayer'),r=c.getBoundingClientRect();return {dpr:devicePixelRatio,boardWidth:r.width,boardHeight:r.height,pixelWidth:c.width,pixelHeight:c.height,scaleX:c.width/r.width,scaleY:c.height/r.height};}));
 }
 return result;
});
findings.clippedDrawing=await session(async page=>{
 await page.locator('#editor').fill(Array(100).fill('Long note line').join('\n'));
 await tools(page);
 await page.evaluate(()=>document.body.scrollTop=3500);
 await page.waitForTimeout(150);
 await page.mouse.move(200,400);await page.mouse.down();await page.mouse.move(450,420,{steps:12});await page.mouse.up();
 await page.waitForTimeout(250);
 await page.keyboard.press('Escape');
 await page.locator('#editor').fill('Now only one line');
 await page.waitForTimeout(1200);
 const ws=await read(page);
 const beforeReload={board:await page.locator('#board').boundingBox(),canvas:await page.locator('#drawingLayer').boundingBox()};
 await page.reload();await page.waitForFunction(()=>document.querySelector('#editor').contentEditable==='true');await page.waitForTimeout(100);
 return {storedMaxY:Math.max(...ws.pages[0].drawings[0].points.map(p=>p.y)),beforeReload,afterReload:{board:await page.locator('#board').boundingBox(),canvas:await page.locator('#drawingLayer').boundingBox()},strokeCount:ws.pages[0].drawings.length};
});
findings.hideDrawingMode=await session(async page=>{
 await tools(page);
 await page.locator('#drawingToolbarVisibilityToggleBtn').click();
 await page.mouse.move(200,300);await page.mouse.down();await page.mouse.move(240,320);await page.mouse.up();
 await page.waitForTimeout(250);
 return {toolbarExpanded:await page.locator('#drawingToolbarVisibilityToggleBtn').getAttribute('aria-expanded'),drawingMode:await page.locator('body').evaluate(el=>el.classList.contains('drawing-mode')),strokes:(await read(page)).pages[0].drawings.length};
});
findings.retrySave=await session(async page=>{
 await page.evaluate(()=>{window.auditOriginalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Audit transient failure','QuotaExceededError');};});
 await page.locator('#editor').fill('Unsaved first edit');
 await page.waitForFunction(()=>document.querySelector('#saveIndicator').classList.contains('error'));
 await page.evaluate(()=>IDBObjectStore.prototype.put=window.auditOriginalPut);
 await page.locator('#settingsToggleBtn').click();
 await page.locator('#retrySaveBtn').click();
 await page.waitForTimeout(350);
 return {persistedText:(await read(page)).pages[0].content,status:await page.locator('#storageStatus').innerText(),indicator:await page.locator('#saveIndicator').getAttribute('class'),retryVisible:await page.locator('#retrySaveBtn').isVisible()};
});
findings.autosaveAfterFailure=await session(async page=>{
 await page.locator('#editor').fill('Initial text');await page.waitForTimeout(1200);
 await page.evaluate(()=>{window.auditOriginalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Audit transient failure','QuotaExceededError');};});
 await page.locator('#editor').fill('Unsaved first edit');
 await page.waitForFunction(()=>document.querySelector('#saveIndicator').classList.contains('error'));
 await page.evaluate(()=>IDBObjectStore.prototype.put=window.auditOriginalPut);
 await page.locator('#editor').fill('Saved second edit');await page.waitForTimeout(1300);
 return {persistedText:(await read(page)).pages[0].content,status:await page.locator('#storageStatus').textContent(),indicator:await page.locator('#saveIndicator').getAttribute('class')};
});
findings.layouts=[];
for(const width of [1440,1280,768,390,320]) {
 findings.layouts.push(await session(async page=>{
  await page.locator('#editor').fill('Blackboard Text\nA quiet place to think.\nПишу, рисую, сохраняю свои заметки.');
  await page.locator('#drawingToolbarVisibilityToggleBtn').click();
  await page.waitForTimeout(350);
  const measurements=await page.evaluate(()=>{const measure=id=>{const el=document.querySelector(id),r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};return {width:innerWidth,editor:measure('#editor'),body:measure('body'),toolbar:measure('#drawingToolbar'),rail:measure('.top-right-rail'),overflow:document.body.scrollWidth>document.body.clientWidth,tools:[...document.querySelectorAll('.drawing-tool-button')].map(el=>({id:el.id,w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height}))};});
  if([1440,390,320].includes(width)) {
   await page.screenshot({path:new URL('drawing-'+width+'.png',out).pathname});
   await page.locator('#settingsToggleBtn').click();await page.waitForTimeout(350);
   await page.screenshot({path:new URL('settings-'+width+'.png',out).pathname});
  }
  return measurements;
 },{viewport:{width,height:900}}));
}
await writeFile(new URL('reproductions.json',out),JSON.stringify(findings,null,2)+'\n');
console.log(JSON.stringify(findings,null,2));
await browser.close();
