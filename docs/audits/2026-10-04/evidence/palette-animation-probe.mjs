import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:720},serviceWorkers:'block'});
await page.goto('http://127.0.0.1:4191/dist/pwa/editor.html');await page.waitForFunction(()=>document.querySelector('#editor').contentEditable==='true');
const results=[];
for(const width of [1440,1280,390,320]) {
 await page.setViewportSize({width,height:900});await page.locator('#editor').fill(Array(50).fill('A long line of text '.repeat(8)).join('\n'));
 await page.locator('#drawingToolbarVisibilityToggleBtn').click();
 const samples=[];
 for(let i=0;i<15;i++) {
  samples.push(await page.evaluate(()=>{const r=document.querySelector('#drawingToolbar').getBoundingClientRect();return {time:performance.now(),x:r.x,y:r.y,w:r.width,h:r.height,onScreen:r.x>=6&&r.right<=innerWidth-6&&r.y>=0&&r.bottom<=innerHeight};}));
  await page.waitForTimeout(20);
 }
 results.push({width,samples});await page.locator('#drawingToolbarVisibilityToggleBtn').click();await page.waitForTimeout(180);
}
await writeFile('docs/audits/2026-10-04/evidence/palette-animation.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(x=>({width:x.width,outside:x.samples.filter(s=>!s.onScreen),settled:x.samples.at(-1)}))));
await browser.close();
