import {cleanCard,duplicateCards} from './model.js';
const open=new Promise((resolve,reject)=>{const r=indexedDB.open('shared-card-library-v2-demo',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('瀏覽器無法儲存資料，請確認不是限制儲存的模式。'));});
async function access(fn,write=false){const db=await open;return new Promise((resolve,reject)=>{const tx=db.transaction('workspace',write?'readwrite':'readonly'),s=tx.objectStore('workspace'),r=s.get('main');let result,problem;r.onsuccess=()=>{const root=r.result || {cards:[],photos:[],audit:[]};try{result=fn(root);if(write)s.put(root,'main');}catch(e){problem=e;tx.abort();}};tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(problem || new Error('資料尚未儲存，請檢查裝置空間。'));tx.onerror=()=>{};});}
const fail=(message,extra={})=>{throw Object.assign(new Error(message),extra);};
const now=()=>new Date().toISOString();
function audit(root,id,action){root.audit.unshift({id:crypto.randomUUID(),card_id:id,actor:'本機試用者',action,at:now()});}
export async function demoApi(path,method='GET',input={}){
  const u=new URL(path,location.origin), p=u.pathname;
  if(p==='/api/bootstrap')return {mode:'browser-demo',user:{email:'本機試用者',role:'owner'},csrf:'demo',googleReady:false,ocrReady:false,driveConnected:false,pendingPhotos:0};
  if(p==='/api/ocr')fail('試用版尚未連接辨識服務。照片會保留，請先手動填寫，或存成待補資料。');
  if(p==='/api/drive/sync')fail('試用資料儲存在此瀏覽器，尚未連接 Google Drive。');
  if(p==='/api/members'){if(method!=='GET')fail('試用模式不會授權真實員工。');return [{email:'本機試用者',role:'owner',active:1}];}
  if(p==='/api/audit')return access(r=>r.audit.slice(0,200));
  if(p==='/api/backup')return access(r=>({version:2,exportedAt:now(),cards:r.cards,photos:r.photos.map(p=>({id:p.id,dataUrl:p.dataUrl}))}));
  if(p==='/api/cards' && method==='GET')return access(r=>r.cards.filter(c=>u.searchParams.has('trash') || !c.deletedAt).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));
  if(p==='/api/photos' && method==='POST')return access(r=>{if(!/^data:image\/(jpeg|png|webp);base64,/.test(input.dataUrl||'') || input.dataUrl.length>12*1024*1024)fail('請選擇 8MB 以內的 JPG、PNG、WebP 圖片。');const id=crypto.randomUUID();r.photos.push({id,dataUrl:input.dataUrl});return {id};},true);
  const photo=p.match(/^\/api\/photos\/([\w-]+)$/);if(photo)return access(r=>r.photos.find(p=>p.id===photo[1])?.dataUrl || '');
  const match=p.match(/^\/api\/cards\/([\w-]+)(\/restore)?$/);
  if((p==='/api/cards' && method==='POST') || (match && method==='PUT'))return access(r=>{
    const old=match?r.cards.find(c=>c.id===match[1]):null;if(match && !old)fail('找不到名片。');if(old && old.revision!==input.revision)fail('另一個視窗已修改此名片，請重新開啟。',{status:409});
    const c=cleanCard(input),id=old?.id || crypto.randomUUID();const dupe=duplicateCards({...c,id},r.cards);if(dupe.length && !input.allowDuplicate)fail('找到相同電話或 Email，請確認是否仍要新增。',{duplicates:dupe});
    const row={...c,id,photoIds:input.photoIds || [],revision:(old?.revision||0)+1,createdAt:old?.createdAt||now(),updatedAt:now(),updatedBy:'本機試用者',deletedAt:null};if(old)r.cards[r.cards.indexOf(old)]=row;else r.cards.push(row);audit(r,id,old?'修改名片':'新增名片');return row;
  },true);
  if(match && (method==='DELETE' || match[2]))return access(r=>{const c=r.cards.find(c=>c.id===match[1]);if(!c)fail('找不到名片。');if(c.revision!==input.revision)fail('名片已更新，請重新整理。');c.deletedAt=match[2]?null:now();c.revision++;audit(r,c.id,match[2]?'還原名片':'移至回收筒');return {ok:true};},true);
  fail('試用模式不支援這項操作。');
}
