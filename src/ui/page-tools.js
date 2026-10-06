import { bindModalDialog } from './dialogs.js';
import { pageText } from '../core/page-tools.js';
import { createIcon } from './icons.js';

export function setupPageTools({ getWorkspace, isWritable, selectPage, pageSettings, publishPage, listSnapshots, listPageHistory, recoverPage, retrySave, redoDrawing, restoreDrawings, closeSettings, openSettings, togglePin, setDrawingDescription, exportPage, addPage }) {
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
  function open(title, { instant = false } = {}) {
    if (!dialog.open) {
      launcher = document.activeElement;
      launchedFromSettings = Boolean(launcher?.closest('.controls-panel'));
    }
    closeSettings();
    request++;
    content.replaceChildren();
    message.textContent = '';
    dialog.querySelector('h2').textContent = title;
    // Keyboard-opened panels do not animate: the shortcut is used many times a
    // day, and any entrance makes it feel slower than it is.
    dialog.classList.toggle('is-instant', instant);
    if (!dialog.open) dialog.showModal();
  }
  function button(label, fn, parent = content, iconName = '') {
    const el = document.createElement('button');
    el.type = 'button';
    const icon = iconName ? createIcon(iconName, 'row-icon') : null;
    if (icon) el.append(icon);
    const text = document.createElement('span');
    text.className = 'row-label';
    text.textContent = label;
    el.append(text);
    el.addEventListener('click', fn); parent.append(el); return el;
  }
  function showPages({ instant = false } = {}) {
    open('Find a page', { instant });
    const input = document.createElement('input');
    input.type = 'search'; input.placeholder = 'Search names and text'; input.setAttribute('aria-label','Search pages');
    content.append(input);
    const results = document.createElement('div'); results.className = 'workspace-results'; content.append(results);
    const workspace = getWorkspace();
    const indexed = [...workspace.pages].sort((a,b)=>Number(b.pinned)-Number(a.pinned)).map(page => ({page,text:pageText(page.content)}));
    function render() {
      results.replaceChildren();
      const query=input.value.trim().toLocaleLowerCase();
      const matches=indexed.filter(({page,text})=>(page.title+' '+text).toLocaleLowerCase().includes(query));
      for(const {page,text} of matches.slice(0,100)) {
        const row=button((page.pinned?'★ ':'')+(page.emoji || '')+' '+(page.title || text.slice(0,48) || 'Untitled page'),()=>{close({restoreFocus:false});selectPage(page.id)},results);
        const snippet=document.createElement('small'),match=text.toLocaleLowerCase().indexOf(query),start=query&&match>=0?Math.max(0,match-45):0;snippet.textContent=(start?'…':'')+text.slice(start,start+150);row.append(snippet);
      }
      message.textContent=matches.length ? matches.length+' pages'+(matches.length>100?' · first 100 shown':'') : 'No pages match your search.';
    }
    input.addEventListener('input',render);render();input.focus();
    if(addPage)button('New page',()=>{close({restoreFocus:false});addPage();},content,'page').disabled=!isWritable();
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
    button('Name, emoji and delete…',()=>{close({restoreFocus:false});pageSettings(page.id)},content,'pencil').disabled=!isWritable();
    button(page.pinned?'Unpin page':'Pin page',()=>{togglePin(page.id);showActions();},content,'pin').disabled=!isWritable();
    button('Share a copy…',()=>{close({restoreFocus:false});publishPage(page.id)},content,'link');
    button('Export text (.txt)',()=>downloadPage(false),content,'download');
    button('Export Markdown (.md)',()=>downloadPage(true),content,'markdown');
    for(const format of ['png','pdf']) {
      const el=button('Export '+format.toUpperCase()+' (text and drawings)',async()=>{el.disabled=true;message.textContent='Preparing export…';try{await exportPage(format);message.textContent=format.toUpperCase()+' exported.';}catch(error){message.textContent=error.message;}finally{el.disabled=false;}},content,'download');
    }
    button('Page history…',()=>void showPageHistory(),content,'history');
    button('Describe drawings…',()=>{
      open('Drawing description');const label=document.createElement('label');label.textContent='A text alternative for people who cannot see the drawing.';
      const textarea=document.createElement('textarea');textarea.rows=4;textarea.maxLength=2000;textarea.value=page.drawingDescription||'';textarea.setAttribute('aria-label','Drawing description');textarea.disabled=!isWritable();label.append(textarea);content.append(label);
      button('Save description',()=>{setDrawingDescription(page.id,textarea.value);message.textContent='Description saved. Shared copies include it.';},content,'page').disabled=!isWritable();
    },content,'text');
    button('Redo drawing',()=>{redoDrawing();message.textContent='Drawing redo applied if available.';},content,'redo').disabled=!isWritable();
    button('Restore cleared drawings',()=>{restoreDrawings();message.textContent='Last cleared drawings restored if available in this session.';},content,'brush').disabled=!isWritable();
    button('Recovery history…',()=>void showRecovery(),content,'history');
    button('Keyboard help',showHelp,content,'keyboard');
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
        let built=false;details.addEventListener('toggle',()=>{if(!details.open||built)return;built=true;for(const page of snapshot.workspace.pages) {
          const row=document.createElement('div');row.className='recovery-page';
          const title=document.createElement('strong');title.textContent=page.title || 'Untitled page';row.append(title);
          const preview=document.createElement('pre');preview.textContent=pageText(page.content).slice(0,600) || 'Empty text';row.append(preview);
          const recover=button('Recover as new page',async()=>{
            recover.disabled=true;
            try {await recoverPage(page);message.textContent='Recovered as a new page. Existing pages were kept.';}
            catch(error){message.textContent=error.message;}
          finally{recover.disabled=!isWritable();}
          },row,'page');recover.disabled=!isWritable();details.append(row);
        }});
      }
    } catch(error){message.textContent=error.message;}
  }
  async function showPageHistory() {
    const ws=getWorkspace(),page=ws.pages.find(p=>p.id===ws.currentPageId);if(!page)return;
    open('Page history');message.textContent='Loading page history…';const ticket=request;
    try{const revisions=await listPageHistory(page.id);if(ticket!==request)return;
      message.textContent=revisions.length?'Up to 25 earlier versions per page, 100 total and 10 MB on this device. Restoring creates a new page.':'No earlier versions yet. Changes save a version at most once every 30 seconds.';
      for(const revision of revisions){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=new Date(revision.createdAt).toLocaleString();details.append(summary);content.append(details);let built=false;
        details.addEventListener('toggle',()=>{if(!details.open||built)return;built=true;const preview=document.createElement('pre');preview.textContent=pageText(revision.page.content).slice(0,1000)||'Empty text';details.append(preview);
          button('Recover as new page',async()=>{try{await recoverPage(revision.page);message.textContent='Recovered as a new page. Existing pages were kept.';}catch(error){message.textContent=error.message;}},details,'page').disabled=!isWritable();
        });
      }
    }catch(error){message.textContent=error.message;}
  }
  function showHelp() {
    open('Keyboard help');
    const lines=[['Find pages','Ctrl / ⌘ K'],['New page','Alt Shift N'],['Indent / unindent','Tab / Shift Tab in the editor'],['Leave the editor or close a panel','Escape'],['Undo / redo text or drawing','Ctrl / ⌘ Z · Ctrl / ⌘ Shift Z'],['Brush / eraser','Alt Shift B / E']];
    const dl=document.createElement('dl');dl.className='workspace-shortcuts';for(const [label,key]of lines){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=key;dl.append(dt,dd)}content.append(dl);
  }
  searchButton.addEventListener('click',()=>showPages());
  const mobilePages=document.createElement('button');mobilePages.type='button';mobilePages.id='mobilePagesBtn';mobilePages.className='mobile-pages-button';mobilePages.setAttribute('aria-label','Find a page');mobilePages.title='Find a page';mobilePages.append(createIcon('page'));mobilePages.addEventListener('click',()=>showPages());document.querySelector('.rail-tools').after(mobilePages);
  actionsButton.addEventListener('click',showActions);
  const status=document.getElementById('storageStatus');
  const retry=document.getElementById('retrySaveBtn');
  const indicator=document.querySelector('#saveIndicator');
  const updateStatus=()=>{
    const failed=indicator.classList.contains('error');
    const pending=['dirty','saving'].includes(document.querySelector('#editor').dataset.saveState);
    status.textContent=!isWritable()?'Read-only copy':failed?'Could not save changes':pending?'Saving…':'Saved on this device';
    retry.hidden=!failed || !isWritable();
  };
  new MutationObserver(updateStatus).observe(indicator,{attributes:true});
  new MutationObserver(updateStatus).observe(document.body,{attributes:true,attributeFilter:['class']});
  new MutationObserver(updateStatus).observe(document.querySelector('#editor'),{attributes:true,attributeFilter:['data-save-state']});
  document.querySelector('#editor').addEventListener('input',()=>{status.textContent='Saving…';});
  retry.addEventListener('click',async()=>{
    if(!isWritable())return;
    retry.disabled=true;
    try{await retrySave();}catch{status.textContent='Could not save changes';}
    finally{retry.disabled=false;updateStatus();}
  });
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!event.isComposing){event.preventDefault();showPages({instant:true});}});
  document.querySelector('#recoveryHistoryBtn')?.addEventListener('click',()=>void showRecovery());
  updateStatus();
  return {showRecovery,showHelp,showPages};
}
