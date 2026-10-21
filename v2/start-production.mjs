import {mkdir,chown} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from './server.mjs';

// New persistent volumes are owned by root. Fix only the configured data
// directory, then run the application without root privileges.
const dir=resolve(dirname(fileURLToPath(import.meta.url)),process.env.DATA_DIR||process.env.RAILWAY_VOLUME_MOUNT_PATH||'data');
if(process.getuid?.()===0){await mkdir(dir,{recursive:true});await chown(dir,1000,1000);process.setgid(1000);process.setuid(1000);}
const {server}=await createApp({demo:false});
server.listen(Number(process.env.PORT||8787),'0.0.0.0',()=>console.log('Shared card library production service started.'));
