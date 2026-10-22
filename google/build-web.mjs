import './build.mjs';
import {readFile,writeFile} from 'node:fs/promises';
let html=await readFile(new URL('./Index.html',import.meta.url),'utf8');
if(!html.includes('const personalRemote=false;'))throw Error('Remote transport marker missing');
html=html.replace('const personalRemote=false;','const personalRemote=true;');
html=html.replace('<head>','<head><meta name="referrer" content="no-referrer">');
await writeFile(new URL('./Library.html',import.meta.url),html);
