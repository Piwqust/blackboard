import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',request=>errors.push(request.url()+': '+request.failure()?.errorText));
  await page.goto('editor.html');
  try { await expect(page.locator('#editor')).toHaveAttribute('contenteditable', 'true'); }
  catch(error) { throw new Error(error.message+'\nLoading errors: '+JSON.stringify(errors)); }
});

test('exact colors, theme reset and accessible palette', async ({page}) => {
  await page.locator('#drawColorBtn').click();
  await expect(page.locator('#colorPickerHexInput')).toHaveValue('#dddad2', {ignoreCase:true});
  await page.locator('#colorPickerHexInput').fill('#123456');
  await expect(page.locator('#drawColor')).toHaveValue('#123456');
  await page.locator('#colorPickerMatchTheme').click();
  await expect(page.locator('#drawColor')).toHaveValue('#dddad2');
  expect(await page.locator('.color-picker-swatch').evaluateAll(nodes=>nodes.every(n=>n.getAttribute('aria-label')))).toBe(true);
  await page.locator('#colorPickerClose').click();
  await page.locator('#settingsToggleBtn').click();
  await page.getByRole('button',{name:'Use Paper theme',exact:true}).click();
  await expect(page.locator('#drawColor')).toHaveValue('#1a1a1a');
  await page.locator('#resetSettings').click();
  await expect(page.locator('[data-theme="blackboard"]')).toHaveClass(/active/);
});

test('readonly tabs expose navigation and backup without writing', async ({page,context}) => {
  await page.locator('#editor').fill('first page');
  await page.locator('#addPageBtn').click();
  await page.locator('#editor').fill('second page');
  await expect(page.locator('#saveIndicator')).toHaveAttribute('aria-label','Saved locally.');
  const other=await context.newPage();
  await other.goto(page.url());
  await expect(other.locator('body')).toHaveClass(/workspace-readonly/);
  await other.locator('.page-tab').first().click();
  await expect(other.locator('#editor')).toHaveText('first page');
  await other.locator('#settingsToggleBtn').click();
  const download=other.waitForEvent('download');
  await other.locator('#exportWorkspaceBtn').click();
  expect((await download).suggestedFilename()).toMatch(/json$/);
  await other.locator('#settingsCloseBtn').click();
  await expect(other.locator('#editor')).toHaveAttribute('contenteditable','false');
});

test('modal dialog isolates background and restores focus', async ({page}) => {
  await expect(page.locator('dialog:visible')).toHaveCount(0);
  await page.locator('.page-tab').click();
  await page.locator('#emojiPickerPublish').click();
  await expect(page.locator('#publishDialog')).toBeVisible();
  const pageCount = await page.locator('.page-tab').count();
  await page.keyboard.press('Alt+Shift+n');
  await expect(page.locator('.page-tab')).toHaveCount(pageCount);
  for(let i=0;i<12;i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(()=>!!document.activeElement.closest('#publishDialog'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#publishDialog')).not.toBeVisible();
  await expect(page.locator('.page-tab')).toBeFocused();
});

test('scroll position survives page switching and reload', async ({page}) => {
  await page.locator('#editor').fill(Array(90).fill('Long note line').join('\n'));
  await page.evaluate(()=>document.body.scrollTop=500);
  await page.locator('#addPageBtn').click();
  await page.locator('.page-tab').first().click();
  await expect.poll(()=>page.evaluate(()=>document.body.scrollTop)).toBe(500);
  await expect.poll(()=>page.evaluate(async()=>{
    const store=(await import('./src/core/workspace-store.js')).createWorkspaceStore();
    const ws=await store.readWorkspace();
    return ws.currentPageId === document.querySelector('.page-tab.active').dataset.pageId;
  })).toBe(true);
  await page.reload();
  await expect.poll(()=>page.evaluate(()=>document.body.scrollTop)).toBe(500);
});

test('real DOM sanitizer preserves text and blocks active markup and requests', async ({page}) => {
  const output=await page.evaluate(async()=>{
    const {sanitizeStoredContent:s}=await import('./src/core/sanitize-html.js');
    return s('<svg><a href="javascript:alert(1)">bad</a></svg><img src="/leak"><video poster="https://bad.test"><source srcset="https://bad.test/a"></video><b onclick="alert(1)">safe</b><a href="java&#10;script:alert(1)">x</a><p style="background:url(https://bad.test)">p</p>',{allowRemoteMedia:false});
  });
  expect(output).not.toMatch(/javascript|src|poster|onclick|style|svg/i);
  expect(output).toContain('<b>safe</b>');
});

test('unavailable Web Locks fails closed', async ({page}) => {
  const result=await page.evaluate(async()=>{
    Object.defineProperty(navigator,'locks',{value:undefined,configurable:true});
    const {acquireWorkspaceLock}=await import('./src/core/workspace-lock.js');
    return acquireWorkspaceLock();
  });
  expect(result).toEqual({acquired:false,reason:'unsupported-locks'});
});

test('write failure is visible and current text remains exportable', async ({page}) => {
  await page.evaluate(()=>{
    window.originalPut=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(){throw new DOMException('Test quota exceeded','QuotaExceededError')};
  });
  await page.locator('#editor').fill('Unsaved text must survive');
  await expect(page.locator('#saveIndicator')).toHaveClass(/error/);
  await page.waitForTimeout(4200);
  await expect(page.locator('#saveIndicator')).toHaveClass(/error/);
  await expect(page.locator('#editor')).toHaveText('Unsaved text must survive');
  await page.locator('#settingsToggleBtn').click();
  const download=page.waitForEvent('download');
  await page.locator('#exportWorkspaceBtn').click();
  const stream=await (await download).createReadStream();
  let data=''; for await (const chunk of stream) data+=chunk;
  expect(data).toContain('Unsaved text must survive');
});

test('fixed tools stay outside the scrolling writing area', async ({page}) => {
  for(const width of [1440,1280,390,320]) {
    await page.setViewportSize({width,height:900});
    await page.locator('#editor').fill(Array(50).fill('A long line of text '.repeat(8)).join('\n'));
    const result=await page.evaluate(()=>{
      const body=document.body.getBoundingClientRect();
      const tools=document.querySelector('#drawingToolbar').getBoundingClientRect();
      const rail=document.querySelector('#pageTabsList').getBoundingClientRect();
      return {bodyTop:body.top,toolsBottom:tools.bottom,bodyRight:body.right,railLeft:rail.left};
    });
    expect(result.bodyTop).toBeGreaterThanOrEqual(result.toolsBottom);
    expect(result.bodyRight).toBeLessThanOrEqual(result.railLeft);
  }
});

test('reader drawing alignment and horizontal containment at all target widths', async ({page}) => {
  const url=await page.evaluate(async()=>{
    const {createPublishedNote,encodePublishedNote,buildPublishedNoteUrl}=await import('./src/core/publish.js');
    const note=createPublishedNote({id:'ref',title:'Alignment',emoji:'📝',content:'Reference line',drawings:[{id:'s',tool:'brush',color:'#ffffff',width:0.1,coordinateSpace:'text-scaled-px',referenceFontSize:40,points:[{x:48,y:98},{x:350,y:98}]}]}, {fontSize:40}, {boardWidth:1440});
    return buildPublishedNoteUrl(location.href,await encodePublishedNote(note));
  });
  // Token prefix is part of the public URL contract.
  await page.goto(url);
  await expect(page.locator('#readerContent')).toHaveText('Reference line');
  for(const width of [1440,1280,390,320]) {
    await page.setViewportSize({width,height:900});
    await expect.poll(()=>page.evaluate(()=>{
      const b=document.querySelector('#readerBoard'),c=document.querySelector('#readerContent'),canvas=document.querySelector('#readerDrawings');
      const scale=b.getBoundingClientRect().width/b.clientWidth;
      return Math.abs((canvas.getBoundingClientRect().top + 98*scale) - (c.getBoundingClientRect().top+50*scale));
    })).toBeLessThan(1);
    expect(await page.evaluate(()=>{document.body.scrollLeft=400;return document.body.scrollLeft})).toBe(0);
  }
});

test('update waits for a durable save and allows retry after failure', async ({page}) => {
  await page.route('**/src/ui/pwa-updates.js', route => route.fulfill({contentType:'text/javascript',body:`export function registerPwaUpdates({onUpdateReady}) {onUpdateReady({apply(){window.testUpdateApplied=true}})}` }));
  await page.reload();
  await expect(page.locator('#editor')).toHaveAttribute('contenteditable','true');
  await page.evaluate(()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Test quota','QuotaExceededError')}});
  await page.locator('#editor').fill('Protect pending changes');
  await page.locator('#reloadForUpdateBtn').click();
  await expect(page.locator('#saveIndicator')).toHaveClass(/error/);
  expect(await page.evaluate(()=>!!window.testUpdateApplied)).toBe(false);
  await page.evaluate(()=>IDBObjectStore.prototype.put=window.originalPut);
  await page.locator('#reloadForUpdateBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.testUpdateApplied)).toBe(true);
});

test('quoted IDs import safely and do not inherit the previous Undo history', async ({page}) => {
  await page.locator('#editor').fill('Old history');
  const id=await page.locator('.page-tab').getAttribute('data-page-id');
  const payload={format:'BlackboardTextWorkspace',schemaVersion:1,workspace:{currentPageId:id,pages:[{id,content:'Imported content'},{id:'quote"[id]',content:'Quoted ID'}],settings:{}}};
  await page.locator('#importWorkspaceInput').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
  await page.locator('#confirmImportBtn').click();
  await expect(page.locator('#editor')).toHaveText('Imported content');
  await page.locator('#editor').focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('#editor')).toHaveText('Imported content');
  await page.locator('.page-tab').nth(1).click();
  await expect(page.locator('#editor')).toHaveText('Quoted ID');
});

test('keyboard exit retains Tab indentation and ignores composing Escape', async ({page}) => {
  await page.locator('#editor').focus();
  await page.keyboard.type('Text');
  await page.keyboard.press('Tab');
  expect(await page.locator('#editor').textContent()).toContain('\t');
  await page.locator('#editor').dispatchEvent('keydown',{key:'Escape',isComposing:true});
  await expect(page.locator('#editor')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#settingsToggleBtn')).toBeFocused();
});

test('loading failure cannot write an empty workspace', async ({page}) => {
  await page.locator('#editor').fill('Keep existing notes');
  await expect(page.locator('#saveIndicator')).toHaveAttribute('aria-label','Saved locally.');
  await page.addInitScript(()=>{
    window.testWrites=0;
    const original=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args){window.testWrites++;return original.apply(this,args)};
    IDBFactory.prototype.open=function(){throw new Error('Test unavailable storage')};
  });
  await page.reload();
  await expect(page.locator('#workspaceModeNotice')).toContainText('could not be loaded');
  await expect(page.locator('#editor')).toHaveAttribute('contenteditable','false');
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(()=>window.testWrites)).toBe(0);
});

test('built-in themes have readable labels and visible keyboard focus', async ({page}) => {
  await page.locator('#editor').fill('Count me');
  await page.locator('#settingsToggleBtn').click();
  const themes=await page.locator('[data-theme]').evaluateAll(nodes=>nodes.map(n=>n.dataset.theme));
  for(const theme of themes) {
    await page.locator('[data-theme="'+theme+'"]').click();
    await page.waitForTimeout(350);
    const ratios=await page.evaluate(()=>{
      const parse=c=>c.match(/[\d.]+/g).map(Number);
      const mix=(fg,bg,opacity=1)=>fg.slice(0,3).map((v,i)=>v*(fg[3]??1)*opacity+bg[i]*(1-(fg[3]??1)*opacity));
      const luminance=c=>c.slice(0,3).map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4}).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);
      const ratio=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
      return [...document.querySelectorAll('.section-label,#wordCount')].map(el=>{
        let bg=[255,255,255];let opacity=1;const chain=[];for(let n=el;n;n=n.parentElement)chain.unshift(n);
        for(const n of chain){const st=getComputedStyle(n);bg=mix(parse(st.backgroundColor),bg);opacity*=Number(st.opacity)}
        return ratio(mix(parse(getComputedStyle(el).color),bg,opacity),bg);
      });
    });
    for(const ratio of ratios) expect(ratio,theme).toBeGreaterThanOrEqual(4.5);
    await page.locator('#fontSize').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    expect(await page.locator('#fontSize').evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('solid');
  }
});

test('page search, non-destructive merge and single-page recovery', async ({page}) => {
  await page.locator('#editor').fill('Unique first note');
  const id=await page.locator('.page-tab').getAttribute('data-page-id');
  const payload={format:'BlackboardTextWorkspace',schemaVersion:1,workspace:{currentPageId:id,pages:[{id,title:'Incoming page',content:'Unique incoming note'}],settings:{}}};
  await page.locator('#importWorkspaceInput').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
  await page.locator('input[name="importMode"][value="add"]').check();
  await page.locator('#confirmImportBtn').click();
  await expect(page.locator('.page-tab')).toHaveCount(2);
  await expect(page.locator('#editor')).toHaveText('Unique first note');
  await page.locator('#findPagesBtn').click();
  await page.getByRole('searchbox',{name:'Search pages'}).fill('incoming');
  await page.locator('.workspace-results button').click();
  await expect(page.locator('#editor')).toHaveText('Unique incoming note');
  await page.locator('#pageActionsBtn').click();
  await page.getByRole('button',{name:'Recovery history…',exact:true}).click();
  await page.locator('#workspaceToolsContent summary').first().click();
  await page.getByRole('button',{name:'Recover as new page'}).first().click();
  await expect(page.locator('#workspaceToolsStatus')).toContainText('Recovered as a new page');
  await expect(page.locator('.page-tab')).toHaveCount(3);
});

test('readable mode preserves original drawings and offers zoom', async ({page}) => {
  await page.locator('#editor').fill('Readable copy');
  await page.locator('#pageActionsBtn').click();
  await page.getByRole('button',{name:'Share a copy…',exact:true}).click();
  await expect(page.locator('#previewPublishLink')).toBeVisible();
  await page.goto(await page.locator('#previewPublishLink').getAttribute('href'));
  await page.locator('#readerTextMode').click();
  await expect(page.locator('#readerContent')).toHaveCSS('font-size','20px');
  await expect(page.locator('#readerDrawings')).toBeHidden();
  await page.locator('#readerBoardMode').click();
  await expect(page.locator('#readerZoom')).toBeVisible();
});

test('drawing undo redo and restore after clear preserve strokes', async ({page}) => {
  await page.locator('#drawToggleBtn').click();
  const rect=await page.locator('#drawingLayer').boundingBox();
  await page.mouse.move(rect.x+60,rect.y+60);await page.mouse.down();await page.mouse.move(rect.x+160,rect.y+110,{steps:5});await page.mouse.up();
  const count=()=>page.evaluate(async()=>{const ws=await (await import('./src/core/workspace-store.js')).createWorkspaceStore().readWorkspace();return ws.pages.find(p=>p.id===ws.currentPageId).drawings.length;});
  await expect.poll(count).toBe(1);
  await page.locator('#undoDrawingBtn').click();await expect.poll(count).toBe(0);
  await page.keyboard.press('ControlOrMeta+Shift+z');await expect.poll(count).toBe(1);
  await page.locator('#clearDrawingsBtn').click();await page.locator('#confirmClearDrawingsBtn').click();await expect.poll(count).toBe(0);
  await page.locator('#pageActionsBtn').click();await page.getByRole('button',{name:'Restore cleared drawings',exact:true}).click();await expect.poll(count).toBe(1);
});
