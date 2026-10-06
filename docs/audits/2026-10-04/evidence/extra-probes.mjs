import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch();
const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:900},deviceScaleFactor:2});
const page=await context.newPage();
const base='http://127.0.0.1:4191/dist/pwa/';
await page.goto(base+'editor.html');
await page.waitForFunction(()=>document.querySelector('#editor').contentEditable==='true');
await page.locator('#editor').fill('Слово');
await page.evaluate(()=>document.body.scrollTop=0);
await page.locator('#drawingToolbarVisibilityToggleBtn').click();await page.locator('#drawToggleBtn').click();
await page.mouse.move(48,115);await page.mouse.down();await page.mouse.move(160,115,{steps:8});await page.mouse.up();
await page.waitForTimeout(200);await page.keyboard.press('Escape');
async function geometry() {
 return page.evaluate(async()=>{
  const ws=await (await import('./src/core/workspace-store.js')).createWorkspaceStore().readWorkspace();
  const s=ws.pages[0].drawings[0], f=parseFloat(getComputedStyle(document.querySelector('#editor')).fontSize);
  const r=document.createRange();r.selectNodeContents(document.querySelector('#editor'));const rect=r.getBoundingClientRect();
  const {convertPointToCanvasPixels}=await import('./src/core/drawing-geometry.js');
  return {fontSize:f,text:{x:rect.x,y:rect.y,height:rect.height},strokeStart:convertPointToCanvasPixels(s.points[0],s.referenceFontSize,f)};
 });
}
const before=await geometry();
await page.locator('#settingsToggleBtn').click();
await page.locator('#fontSize').evaluate(el=>{el.value='80';el.dispatchEvent(new Event('input',{bubbles:true}));});
await page.waitForTimeout(300);const after=await geometry();
await page.locator('#settingsCloseBtn').click();
await page.screenshot({path:'docs/audits/2026-10-04/evidence/font-resize-drawing.png'});
const printState=await page.emulateMedia({media:'print'}).then(()=>page.evaluate(()=>({canvasDisplay:getComputedStyle(document.querySelector('#drawingLayer')).display,canvasVisibility:getComputedStyle(document.querySelector('#drawingLayer')).visibility}))); 
const data={fontResize:{before,after},printState};
await writeFile('docs/audits/2026-10-04/evidence/extra-reproductions.json',JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data));
await context.close();await browser.close();
