import {createShareStore} from '../core/share-store.js';
import {newShareCredentials, shortLinksEndpoint, shortLinkUrl, uploadShortLink, revokeShortLink} from '../core/short-links.js';

export function setupShortLinks({dialog, getSnapshot, baseUrl, onError}) {
  const store = createShareStore();
  const shortMode = document.getElementById('shareModeShort');
  const fullMode = document.getElementById('shareModeFull');
  const shortPanel = document.getElementById('shortLinkPanel');
  const fullPanel = document.getElementById('fullLinkPanel');
  const create = document.getElementById('createShortLinkBtn');
  const status = document.getElementById('shortLinkStatus');
  const result = document.getElementById('shortLinkResult');
  const copy = document.getElementById('copyShortLinkBtn');
  const preview = document.getElementById('previewShortLink');
  const list = document.getElementById('sharedLinksList');
  const endpoint = shortLinksEndpoint();
  let busy = false;
  let currentId = null;
  let generation = 0;
  let listRequest = 0;
  function mode() {
    shortPanel.hidden = !shortMode.checked;
    fullPanel.hidden = !fullMode.checked;
    document.getElementById('publishDrawingsOption').hidden = !getSnapshot(false)?.hasDrawings;
  }
  shortMode.addEventListener('change',mode);fullMode.addEventListener('change',mode);
  shortMode.disabled = !endpoint;
  document.getElementById('shortLinkSetupHint').hidden = Boolean(endpoint);
  create.disabled = !endpoint;
  async function copyText(text, input) {
    try {await navigator.clipboard.writeText(text);status.textContent = 'Link copied.';}
    catch {if (input) {input.focus();input.select();}status.textContent = 'Select the link and copy it with Ctrl/⌘ C.';}
  }
  function showResult(record) {
    currentId = record.id;
    result.value = record.url;
    result.hidden = false;copy.hidden = false;
    preview.href = record.url;preview.hidden = false;
    status.textContent = 'Short link ready. It opens the saved copy, including its selected appearance and drawings.';
  }
  async function upload(record, ticket) {
    const response = await uploadShortLink(record);
    const active = {...record, state:'active', createdAt:response.createdAt};
    // The pending record already contains the key; local failure never loses revocation access.
    delete active.token;
    await store.put(active);
    if (ticket === generation && dialog.open) showResult(active);
    await refresh();
  }
  create.addEventListener('click', async () => {
    if (busy || !endpoint) return;
    const ticket = generation;busy = true;create.disabled = true;
    status.textContent = 'Saving this copy…';
    try {
      // Capture before any asynchronous work so later edits cannot change the snapshot.
      const snapshot = await getSnapshot(true);
      const credentials = newShareCredentials();
      const record = {...credentials, token:snapshot.token, title:snapshot.title || 'Untitled page',
        pageId:snapshot.pageId, createdAt:new Date().toISOString(), state:'pending',
        endpoint, url:shortLinkUrl(baseUrl(), credentials.id)};
      await store.put(record); // Must succeed before uploading anything.
      await upload(record, ticket);
    } catch(error) {
      if (ticket === generation) status.textContent = error.message + ' If a request was sent, check Shared links below before trying again.';
      onError?.(error);
      await refresh();
    } finally {busy = false;create.disabled = !endpoint;}
  });
  copy.addEventListener('click',()=>void copyText(result.value,result));
  async function refresh() {
    const ticket = ++listRequest;
    try {
      const records = await store.list();
      if (ticket !== listRequest) return;
      list.replaceChildren();
      if (!records.length) {list.textContent = 'No short links created in this browser yet.';return;}
      for (const record of records) {
        const row = document.createElement('div'); row.className = 'shared-link-row';
        const title = document.createElement('strong');title.textContent = record.title;row.append(title);
        const meta = document.createElement('small');meta.textContent = new Date(record.createdAt).toLocaleString()+' · '+({active:'Published copy',pending:'Creation needs confirmation',revoked:'Disabled'}[record.state] || 'Unknown');row.append(meta);
        if (record.state !== 'revoked') {
          const input = document.createElement('input');input.readOnly = true;input.value = record.url;input.setAttribute('aria-label','Short link for '+record.title);row.append(input);
          const actions=document.createElement('div');actions.className='shared-link-actions';row.append(actions);
          const add=(text,fn)=>{const b=document.createElement('button');b.type='button';b.className='delete-confirm-cancel';b.textContent=text;b.addEventListener('click',fn);actions.append(b);return b;};
          if(record.state==='active') add('Copy',()=>void copyText(record.url,input));
          if(record.state==='pending' && record.token) {
            const retry=add('Retry same link',async()=>{
              retry.disabled=true;
              try {await upload(record,generation);}catch(error){meta.textContent=error.message;}
              finally{retry.disabled=false;}
            });retry.disabled=record.endpoint!==endpoint;
          }
          const disable=add('Disable link',()=>{
            disable.hidden=true;
            const explanation=document.createElement('p');explanation.textContent='Stop future opening of this link? Copies already saved by recipients are not removed.';row.append(explanation);
            const cancel=add('Keep link',()=>{disable.hidden=false;explanation.remove();cancel.remove();confirm.remove();});
            const confirm=add('Confirm disable',async()=>{
              confirm.disabled=true;cancel.disabled=true;
              try {
                await revokeShortLink(record);
                await store.put({...record,token:undefined,state:'revoked',revokedAt:new Date().toISOString()});
                if(currentId===record.id){result.hidden=true;copy.hidden=true;preview.hidden=true;status.textContent='This short link is disabled.';}
                await refresh();
              } catch(error){meta.textContent=error.message;confirm.disabled=false;cancel.disabled=false;}
            });
          });disable.disabled=record.endpoint!==endpoint;
        }
        list.append(row);
      }
    } catch(error){list.textContent='Link management storage is unavailable: '+error.message;}
  }
  document.getElementById('sharedLinksDetails').addEventListener('toggle',event=>{if(event.target.open) void refresh();});
  return {
    open() {
      generation++;currentId=null;result.hidden=true;copy.hidden=true;preview.hidden=true;
      status.textContent='Only this selected copy will be uploaded. Changes to your local page will need a new link.';
      shortMode.checked=Boolean(endpoint);fullMode.checked=!endpoint;
      create.disabled=busy||!endpoint;
      mode();void refresh();
    },
    close(){generation++;}
  };
}
