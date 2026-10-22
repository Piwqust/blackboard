import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
// Short-link tests point the app at a local Worker (SHORT_LINKS_TEST_API). A
// release build adds its service to each page's CSP; the test server does the
// same for the local one.
const testApi=process.env.SHORT_LINKS_TEST_API?new URL(process.env.SHORT_LINKS_TEST_API).origin:'';
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.txt':'text/plain','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);res.end();return;}
    if((await stat(file)).isDirectory())file=path.join(file,'index.html');
    let bytes=await readFile(file);
    if(testApi&&path.extname(file)==='.html')bytes=Buffer.from(bytes.toString('utf8').replace("connect-src 'self'","connect-src 'self' "+testApi));
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:bytes);
  } catch {res.writeHead(404);res.end('Not found');}
});
// TEST_PORT lets several checkouts run their browser tests side by side.
server.listen(Number(process.env.TEST_PORT)||4190,'127.0.0.1');
