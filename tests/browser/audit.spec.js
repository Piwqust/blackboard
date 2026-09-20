import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await page.goto('editor.html');
  await expect(page.locator('#editor')).toHaveAttribute('contenteditable', 'true');
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
