import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const runtime=spawn(process.execPath,['--import','tsx','apps/personal-runtime/src/main.ts'],{stdio:'inherit',env:{...process.env,PWACLOUD_MODE:process.env.PWACLOUD_MODE??'demo',PWACLOUD_PORT:'4173'}});
const server=await createServer({root:fileURLToPath(new URL('../apps/shell',import.meta.url)),server:{host:'127.0.0.1',port:5173,proxy:{'/v1':{target:'http://127.0.0.1:4173',changeOrigin:true,configure(proxy){proxy.on('proxyReq',request=>request.setHeader('origin','http://127.0.0.1:4173'));}},'/health':'http://127.0.0.1:4173','/fixtures':'http://127.0.0.1:4173','/guest':'http://127.0.0.1:4173'}}});
await server.listen();server.printUrls();
const close=async()=>{runtime.kill();await server.close();};process.once('SIGINT',()=>void close());process.once('SIGTERM',()=>void close());
