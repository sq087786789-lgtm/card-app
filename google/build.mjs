import './build-personal.mjs';
import {readFile,writeFile} from 'node:fs/promises';
const source=await Promise.all(['Code.gs','Login.gs'].map(name=>readFile(new URL('./'+name,import.meta.url),'utf8')));
await writeFile(new URL('./Deploy.gs',import.meta.url),source.join('\n'));
