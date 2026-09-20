import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,rm,open} from 'node:fs/promises';
import path from 'node:path';

await mkdir('.tmp',{recursive:true});
const state=await mkdtemp(path.resolve('.tmp/short-links-test-'));
const log=await open(path.join(state,'worker.log'),'w');
const wrangler=path.resolve('node_modules/wrangler/bin/wrangler.js');
const config=path.resolve('backend/short-links/wrangler.jsonc');
const endpoint='http://127.0.0.1:8788';
const env={...process.env,WRANGLER_SEND_METRICS:'false',SHORT_LINKS_TEST_API:endpoint};
function run(args) {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,args,{env,stdio:'inherit'});
    child.on('error',reject);
    child.on('exit',code=>code===0?resolve():reject(new Error('Command failed: '+args.join(' ')+' (exit '+code+')')));
  });
}
let server;
try {
  await run([wrangler,'d1','migrations','apply','blackboard-text-shares','--local','--config',config,'--persist-to',state]);
  server=spawn(process.execPath,[wrangler,'dev','--config',config,'--port','8788','--persist-to',state,'--var','ALLOWED_ORIGINS:http://127.0.0.1:4190,https://piwqust.github.io'],{env,stdio:['ignore',log.fd,log.fd]});
  const deadline=Date.now()+30000;
  for (;;) {
    try { if((await fetch(endpoint+'/health')).ok) break; } catch { /* Wait for workerd. */ }
    if(server.exitCode!==null || Date.now()>deadline)throw new Error('Local short-link Worker failed to start. See '+path.join(state,'worker.log'));
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  await run(['tests/short-links-api.mjs']);
  await run(['node_modules/@playwright/test/cli.js','test','short-links.spec.js','--reporter=line']);
} finally {
  if(server && server.exitCode===null) {
    server.kill('SIGTERM');
    await new Promise(resolve=>{
      const force=setTimeout(()=>{server.kill('SIGKILL');resolve();},5000);
      server.once('exit',()=>{clearTimeout(force);resolve();});
    });
  }
  await log.close();
  await rm(state,{recursive:true,force:true});
}
