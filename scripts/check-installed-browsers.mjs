import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
const evidence='docs/ui-cleanup-2.3.1';
await mkdir(evidence,{recursive:true});
const results=[];
for(const channel of ['chrome','msedge']) {
  const browser=await chromium.launch({channel});
  const context=await browser.newContext({serviceWorkers:'block',deviceScaleFactor:2});
  try {
    const page=await context.newPage();
    await page.goto('http://127.0.0.1:4190/dist/pwa/editor.html');
    await page.locator('#editor[contenteditable=true]').waitFor();
    await page.locator('#drawingToolbarVisibilityToggleBtn').click();
    await page.locator('#editor').fill('A quiet place to think.\n\nNotes, sketches and ideas stay together.');
    for(let i=0;i<11;i++) await page.locator('#addPageBtn').click();
    await page.locator('.page-tab').first().click();
    const layouts=[];
    for(const width of [1440,1280,390,320]) {
      await page.setViewportSize({width,height:900});
      await page.locator('#editor').fill('A quiet place to think.\n\nNotes, sketches and ideas stay together.');
      const layout=await page.evaluate(()=>{
        const body=document.body.getBoundingClientRect(),tools=document.querySelector('#drawingToolbar').getBoundingClientRect(),rail=document.querySelector('#pageTabsList').getBoundingClientRect(),actions=document.querySelector('.workspace-actions');
        return {width:innerWidth,bodyTop:body.top,bodyRight:body.right,toolsLeft:tools.left,railLeft:rail.left,workspaceBarPresent:Boolean(actions)};
      });
      if(layout.bodyTop!==0 || layout.bodyRight>layout.toolsLeft || layout.workspaceBarPresent || layout.bodyRight>layout.railLeft) throw Error('Overlapping fixed controls: '+JSON.stringify(layout));
      layouts.push(layout);
      await page.screenshot({path:evidence+'/'+channel+'-'+width+'.png'});
    }
    results.push({channel,version:browser.version(),dpr:2,pages:12,layouts});
  } finally {await context.close();await browser.close();}
}
await writeFile(evidence+'/installed-browsers.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results));
