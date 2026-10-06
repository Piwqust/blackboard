import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'docs/updates/2.4.0/evidence');await mkdir(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.otf':'font/otf','.ttf':'font/ttf','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep))throw Error('path');if((await stat(file)).isDirectory())file=path.join(file,'index.html');const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(4192,'127.0.0.1',resolve));
const reports=[];
try {
 for(const channel of ['chrome','msedge']){
  const browser=await chromium.launch({channel});
  try{const context=await browser.newContext({serviceWorkers:'block',deviceScaleFactor:2});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:4192/dist/pwa/editor.html');await page.waitForFunction(()=>document.querySelector('#editor').contentEditable==='true');
   const sizes=[];
   for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:900});await page.locator('#editor').fill('Blackboard Text\nA quiet place to think.\nПишу, рисую, сохраняю свои заметки.');
    await page.evaluate(()=>document.body.scrollTop=0);
    if(await page.locator('#drawingToolbarVisibilityToggleBtn').getAttribute('aria-expanded')==='true')await page.locator('#drawingToolbarVisibilityToggleBtn').click();
    await page.screenshot({path:path.join(out,channel+'-closed-'+width+'.png')});await page.locator('#drawingToolbarVisibilityToggleBtn').click();await page.waitForTimeout(250);
    const rect=await page.locator('#drawingToolbar').boundingBox();if(rect.x<0||rect.x+rect.width>width||rect.y<0||rect.y>24)throw Error('Toolbar outside viewport');
    sizes.push(await page.evaluate(()=>({width:innerWidth,editorWidth:document.querySelector('#editor').clientWidth,overflow:document.body.scrollWidth>document.body.clientWidth,canvasScale:document.querySelector('#drawingLayer').width/parseFloat(document.querySelector('#drawingLayer').style.width)})));
    await page.screenshot({path:path.join(out,channel+'-drawing-'+width+'.png')});await page.locator('#drawingMoreBtn').click();await page.screenshot({path:path.join(out,channel+'-advanced-'+width+'.png')});
    await page.locator('#settingsToggleBtn').click();await page.waitForTimeout(250);await page.screenshot({path:path.join(out,channel+'-settings-'+width+'.png')});await page.locator('#settingsCloseBtn').click();
   }
   await page.setViewportSize({width:1280,height:900});await page.locator('#settingsToggleBtn').click();await page.locator('#interfaceLanguage').selectOption('ru');await page.waitForTimeout(100);await page.screenshot({path:path.join(out,channel+'-settings-ru.png')});await page.locator('#settingsCloseBtn').click();if(await page.locator('#drawingMoreBtn').getAttribute('aria-expanded')!=='true')await page.locator('#drawingMoreBtn').click();await page.screenshot({path:path.join(out,channel+'-advanced-ru.png')});
   if(channel==='chrome'){
    await page.locator('#drawToggleBtn').click();await page.locator('#drawingMoreBtn').click();await page.mouse.move(80,570);await page.mouse.down();for(let i=1;i<=48;i++)await page.mouse.move(80+i*9,570+Math.sin(i/7)*45);await page.mouse.up();await page.screenshot({path:path.join(out,'smooth-brush.png')});
    await page.keyboard.press('Escape');await page.locator('#editor').fill(Array.from({length:85},(_,i)=>'Строка '+String(i+1).padStart(2,'0')+'. Текст сохраняется в PDF целиком.').join('\n'));await page.locator('#settingsToggleBtn').click();await page.locator('#interfaceLanguage').selectOption('en');await page.locator('#pageActionsBtn').click();const event=page.waitForEvent('download');await page.getByRole('button',{name:'Export PDF (text and drawings)',exact:true}).click();await(await event).saveAs(path.join(out,'export-long.pdf'));
   }
   if(errors.length)throw Error(errors.join('\n'));reports.push({channel,version:browser.version(),errors,viewports:sizes});await context.close();
  }finally{await browser.close();}
 }
 await writeFile(path.join(out,'installed-browsers.json'),JSON.stringify(reports,null,2)+'\n');console.log(JSON.stringify(reports));
}finally{await new Promise(resolve=>server.close(resolve));}
