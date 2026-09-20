import { bindModalDialog } from './dialogs.js';
import { pageText } from '../core/page-tools.js';

export function setupPageTools({ getWorkspace, isWritable, selectPage, pageSettings, publishPage, listSnapshots, recoverPage, retrySave, redoDrawing, restoreDrawings, closeSettings, openSettings }) {
  const searchButton = document.getElementById('findPagesBtn');
  const actionsButton = document.getElementById('pageActionsBtn');
  document.getElementById('findPagesShortcut').textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';

  const dialog = document.createElement('dialog');
  dialog.className = 'backup-dialog workspace-dialog';
  dialog.id = 'workspaceToolsDialog';
  dialog.setAttribute('aria-labelledby', 'workspaceToolsTitle');
  dialog.innerHTML = '<div class="backup-dialog-surface">'
    + '<div class="workspace-dialog-heading">'
    + '<div class="workspace-dialog-title"><p class="backup-dialog-eyebrow">Workspace</p><h2 id="workspaceToolsTitle"></h2></div>'
    + '<button type="button" id="workspaceToolsClose" class="dialog-close" aria-label="Close workspace panel">'
    + '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6L18 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 6L6 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    + '</button>'
    + '</div>'
    + '<div id="workspaceToolsContent"></div>'
    + '<p id="workspaceToolsStatus" class="dialog-note" role="status"></p></div>';
  document.body.append(dialog);
  const content = dialog.querySelector('#workspaceToolsContent');
  const message = dialog.querySelector('#workspaceToolsStatus');
  let launcher;
  let launchedFromSettings = false;
  let request = 0;
  const close = ({restoreFocus = true} = {}) => {
    request++;
    dialog.close();
    if (restoreFocus) {
      if (launchedFromSettings) openSettings();
      launcher?.focus();
    }
  };
  bindModalDialog(dialog, close);
  dialog.querySelector('#workspaceToolsClose').addEventListener('click', close);
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  function open(title) {
    if (!dialog.open) {
      launcher = document.activeElement;
      launchedFromSettings = Boolean(launcher?.closest('.controls-panel'));
    }
    closeSettings();
    request++;
    content.replaceChildren();
    message.textContent = '';
    dialog.querySelector('h2').textContent = title;
    if (!dialog.open) dialog.showModal();
  }
  function button(label, fn, parent = content) {
    const el = document.createElement('button');
    el.type = 'button'; el.textContent = label;
    el.addEventListener('click', fn); parent.append(el); return el;
  }
  function showPages() {
    open('Find a page');
    const input = document.createElement('input');
    input.type = 'search'; input.placeholder = 'Search names and text'; input.setAttribute('aria-label','Search pages');
    content.append(input);
    const results = document.createElement('div'); results.className = 'workspace-results'; content.append(results);
    const workspace = getWorkspace();
    const indexed = workspace.pages.map(page => ({page,text:pageText(page.content)}));
    function render() {
      results.replaceChildren();
      const query=input.value.trim().toLocaleLowerCase();
      const matches=indexed.filter(({page,text})=>(page.title+' '+text).toLocaleLowerCase().includes(query));
      for(const {page,text} of matches.slice(0,100)) {
        const row=button((page.emoji || '')+' '+(page.title || text.slice(0,48) || 'Untitled page'),()=>{close({restoreFocus:false});selectPage(page.id)},results);
        const snippet=document.createElement('small');snippet.textContent=text.slice(0,150);row.append(snippet);
      }
      message.textContent=matches.length ? matches.length+' pages'+(matches.length>100?' · first 100 shown':'') : 'No pages match your search.';
    }
    input.addEventListener('input',render);render();input.focus();
  }
  function downloadPage(markdown) {
    const workspace=getWorkspace();const page=workspace.pages.find(p=>p.id===workspace.currentPageId);
    if(!page)return;
    const text=(markdown && page.title?'# '+page.title+'\n\n':'')+pageText(page.content,{markdown})+'\n';
    const a=document.createElement('a');const url=URL.createObjectURL(new Blob([text],{type:markdown?'text/markdown;charset=utf-8':'text/plain;charset=utf-8'}));
    a.href=url;a.download=(page.title || 'Untitled page').replace(/[\\/:*?"<>|]/g,'_').slice(0,80)+(markdown?'.md':'.txt');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    message.textContent='Text exported. Drawings stay in the workspace backup.';
  }
  function showActions() {
    open('Page actions');
    const workspace=getWorkspace();const page=workspace.pages.find(p=>p.id===workspace.currentPageId);
    if(!page)return;
    button('Name, emoji and delete…',()=>{close({restoreFocus:false});pageSettings(page.id)}).disabled=!isWritable();
    button('Share a copy…',()=>{close({restoreFocus:false});publishPage(page.id)});
    button('Export text (.txt)',()=>downloadPage(false));
    button('Export Markdown (.md)',()=>downloadPage(true));
    button('Redo drawing',()=>{redoDrawing();message.textContent='Drawing redo applied if available.';}).disabled=!isWritable();
    button('Restore cleared drawings',()=>{restoreDrawings();message.textContent='Last cleared drawings restored if available in this session.';}).disabled=!isWritable();
    button('Recovery history…',()=>void showRecovery());
    button('Keyboard help',showHelp);
  }
  async function showRecovery() {
    open('Recovery history');
    message.textContent='Loading snapshots…';const ticket=request;
    try {
      const snapshots=await listSnapshots();if(ticket!==request)return;
      message.textContent=snapshots.length?'Up to 7 snapshots are kept on this device. Recovering a page creates a new page.':'No snapshots yet. Importing or deleting saves a recovery snapshot first.';
      for(const snapshot of snapshots) {
        const details=document.createElement('details');details.className='recovery-snapshot';const summary=document.createElement('summary');
        summary.textContent=new Date(snapshot.createdAt).toLocaleString()+' · '+snapshot.label+' · '+snapshot.workspace.pages.length+' pages';details.append(summary);content.append(details);
        for(const page of snapshot.workspace.pages) {
          const row=document.createElement('div');row.className='recovery-page';
          const title=document.createElement('strong');title.textContent=page.title || 'Untitled page';row.append(title);
          const preview=document.createElement('pre');preview.textContent=pageText(page.content).slice(0,600) || 'Empty text';row.append(preview);
          const recover=button('Recover as new page',async()=>{
            recover.disabled=true;
            try {await recoverPage(page);message.textContent='Recovered as a new page. Existing pages were kept.';}
            catch(error){message.textContent=error.message;}
            finally{recover.disabled=!isWritable();}
          },row);recover.disabled=!isWritable();details.append(row);
        }
      }
    } catch(error){message.textContent=error.message;}
  }
  function showHelp() {
    open('Keyboard help');
    const lines=[['Find pages','Ctrl / ⌘ K'],['New page','Alt Shift N'],['Indent / unindent','Tab / Shift Tab in the editor'],['Leave the editor or close a panel','Escape'],['Undo / redo text or drawing','Ctrl / ⌘ Z · Ctrl / ⌘ Shift Z'],['Brush / eraser','Alt Shift B / E']];
    const dl=document.createElement('dl');dl.className='workspace-shortcuts';for(const [label,key]of lines){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=key;dl.append(dt,dd)}content.append(dl);
  }
  searchButton.addEventListener('click',showPages);
  actionsButton.addEventListener('click',showActions);
  const status=document.getElementById('storageStatus');
  const retry=document.getElementById('retrySaveBtn');
  const indicator=document.querySelector('#saveIndicator');
  const updateStatus=()=>{
    const failed=indicator.classList.contains('error');
    status.textContent=!isWritable()?'Read-only copy':failed?'Could not save changes':'Saved on this device';
    retry.hidden=!failed || !isWritable();
  };
  new MutationObserver(updateStatus).observe(indicator,{attributes:true});
  new MutationObserver(updateStatus).observe(document.body,{attributes:true,attributeFilter:['class']});
  document.querySelector('#editor').addEventListener('input',()=>{status.textContent='Saving…';});
  retry.addEventListener('click',async()=>{
    if(!isWritable())return;
    retry.disabled=true;
    try{await retrySave();}catch{status.textContent='Could not save changes';}
    finally{retry.disabled=false;updateStatus();}
  });
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!event.isComposing){event.preventDefault();showPages();}});
  document.querySelector('#recoveryHistoryBtn')?.addEventListener('click',()=>void showRecovery());
  updateStatus();
  return {showRecovery,showHelp};
}
