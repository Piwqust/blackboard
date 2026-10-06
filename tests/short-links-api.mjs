// Run against local workerd and real SQLite/D1. No mocked storage.
import assert from 'node:assert/strict';
import {newShareCredentials} from '../src/core/short-links.js';
import {createPublishedNote,encodePublishedNote} from '../src/core/publish.js';
const base = process.env.SHORT_LINKS_TEST_API || 'http://127.0.0.1:8787';
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw new Error('This destructive test only supports a local API.');
const origin='https://piwqust.github.io';
const actor=()=> '203.0.113.'+Math.ceil(Math.random()*200);
const request=(id,method,key,token,extra={})=>fetch(base+'/v1/notes/'+id,{
  method,headers:{Origin:origin,'CF-Connecting-IP':actor(),...(key?{Authorization:'Bearer '+key}:{}),...(token?{'Content-Type':'application/json'}:{}),...extra},
  body:token===undefined?undefined:JSON.stringify({token})
});
const note=await encodePublishedNote(createPublishedNote({content:'API regression copy',id:'test'},{}));
const {id,managementKey}=newShareCredentials();
assert.equal((await request(id,'OPTIONS',undefined,undefined,{'Access-Control-Request-Method':'PUT','Access-Control-Request-Headers':'Authorization, Content-Type'})).status,204);
assert.equal((await request(id,'PUT',managementKey,note,{Origin:'https://other.invalid'})).status,403);
assert.equal((await request(id,'PUT',undefined,note)).status,401);
assert.equal((await request(id,'PUT',managementKey,'invalid')).status,400);
assert.equal((await request(id,'PUT',managementKey,note)).status,200);
assert.equal((await request(id,'PUT',managementKey,note)).status,200);
const otherKey=newShareCredentials().managementKey;
assert.equal((await request(id,'PUT',otherKey,note)).status,409);
assert.equal((await request(id,'DELETE',otherKey)).status,404);
const changed=await encodePublishedNote(createPublishedNote({content:'different',id:'test'},{}));
assert.equal((await request(id,'PUT',managementKey,changed)).status,409);
const read=await request(id,'GET');
assert.match(read.headers.get('Cache-Control'),/no-store/);
assert.equal(read.headers.get('Access-Control-Allow-Origin'),origin);
assert.deepEqual(await read.json(),{token:note});
assert.equal((await request(id,'DELETE',managementKey)).status,204);
assert.equal((await request(id,'GET')).status,404);
assert.equal((await request(id,'PUT',managementKey,note)).status,410);
assert.equal((await request(id,'DELETE',managementKey)).status,204);
assert.equal((await request(id,'PUT',managementKey,'1p'+'a'.repeat(902000))).status,413);
console.log('API checks passed: CORS, ownership, immutable/idempotent upload, no-store, revoke/tombstone, size limits.');
