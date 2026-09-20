import {test,expect,chromium} from '@playwright/test';
import {readFile,mkdtemp,rm,cp,writeFile,utimes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('real PWA first install and offline reload retain notes', async ({browser},testInfo) => {
  test.skip(testInfo.project.name!=='pwa');
  const context=await browser.newContext({serviceWorkers:'allow'});
  try {
    const page=await context.newPage();
    await page.goto(testInfo.project.use.baseURL+'editor.html');
    await expect(page.locator('#editor')).toHaveAttribute('contenteditable','true');
    await page.locator('#editor').fill('Offline survivor');
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
    await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
    await expect(page.locator('#editor')).toHaveText('Offline survivor');
    await expect(page.locator('#saveIndicator')).toHaveAttribute('aria-label','Saved locally.');
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#editor')).toHaveText('Offline survivor');
    await expect(page.locator('#editor')).toHaveAttribute('contenteditable','true');
  } finally {await context.close();}
});

test('real extension migrates Chrome storage and keeps source data', async ({browserName},testInfo) => {
  expect(browserName).toBe('chromium');
  test.skip(testInfo.project.name!=='edge-extension');
  const profile=await mkdtemp(path.join(tmpdir(),'blackboard-extension-'));
  const extension=path.resolve('dist/edge-extension');
  const context=await chromium.launchPersistentContext(profile,{headless:true,channel:'chromium',args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
  try {
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id=new URL(worker.url()).host;
    const legacy={pages:[{id:'legacy',content:'Legacy notes kept',drawings:[{width:4,points:[{x:48,y:98},{x:100,y:98}]}]}],currentPageId:'legacy'};
    await worker.evaluate(async data=>{await chrome.storage.local.set(data);await chrome.storage.sync.set({settings:{fontSize:80}});},legacy);
    const page=await context.newPage();
    await page.goto('chrome-extension://'+id+'/editor.html');
    await expect(page.locator('#editor')).toHaveText('Legacy notes kept');
    const stored=await page.evaluate(async()=>await (await import('./src/core/workspace-store.js')).createWorkspaceStore().readWorkspace());
    expect(stored.pages[0].drawings[0].width*80).toBe(4);
    expect(await worker.evaluate(async()=>await chrome.storage.local.get(['pages','currentPageId']))).toEqual(legacy);
    await page.reload();
    await expect(page.locator('#editor')).toHaveText('Legacy notes kept');
  } finally {await context.close();await rm(profile,{recursive:true,force:true});}
});

test('real waiting service worker updates only after saving', async ({browser},testInfo) => {
  test.skip(testInfo.project.name!=='pwa');
  const fixture=await mkdtemp(path.resolve('.tmp/pwa-update-'));
  await cp('dist/pwa',fixture,{recursive:true});
  const relative=path.relative('.',fixture).split(path.sep).join('/');
  const base='http://127.0.0.1:4190/'+relative+'/';
  const context=await browser.newContext({serviceWorkers:'allow'});
  try {
    const page=await context.newPage();await page.goto(base+'editor.html');
    await page.evaluate(async()=>await navigator.serviceWorker.ready);
    await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
    await page.reload();
    await expect(page.locator('#editor')).toHaveAttribute('contenteditable','true');
    const workerPath=path.join(fixture,'pwa-sw.js');
    const worker=await readFile(workerPath,'utf8');
    await writeFile(workerPath,worker.replace("const APP_VERSION = '2.2.1'", "const APP_VERSION = '2.2.1-test-update'"));
    // http.server uses second-resolution Last-Modified validation.
    const changed = new Date(Date.now()+2000);
    await utimes(workerPath, changed, changed);
    await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
    await expect(page.locator('#reloadForUpdateBtn')).toBeVisible();
    await page.locator('#editor').fill('Typed immediately before update');
    await Promise.all([page.waitForEvent('load'), page.locator('#reloadForUpdateBtn').click()]);
    await expect(page.locator('#editor')).toHaveText('Typed immediately before update');
  } finally {await context.close();await rm(fixture,{recursive:true,force:true});}
});
