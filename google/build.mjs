import {readFile,writeFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
let app=await read('../v2/public/app.js');
function replace(pattern,value){if(!app.match(pattern))throw new Error('Frontend source changed: '+pattern);app=app.replace(pattern,()=>value);}
replace(/^import .*\r?\n/,'');
replace(/const browserDemo=.*?;/,'const browserDemo=false;');
replace(/const demo=browserDemo .*?;/,'const demo=null;');
replace(/async function api\(path,method='GET',data\)\{[\s\S]*?\n\}/,`async function api(path,method='GET',data){
  const result=await gasCall('api',[sessionStorage.getItem('card-session')||'',path,method,data||{}]);
  if(path==='/api/logout')sessionStorage.removeItem('card-session');return result;
}`);
replace(/async function photoUrl\(id\)\{[^\n]+\}/,`async function photoUrl(id){if(!id)return '';if(!photoCache.has(id))photoCache.set(id,await api('/api/photos/'+id));return photoCache.get(id);}`);
replace(/href="\/auth\/google"/,'href="#" id="googleSignIn"');
replace(/\$\('#addCard'\)\.hidden=true;\}/,`$('#addCard').hidden=true;$('#googleSignIn').onclick=signInGoogle;}`);
const driveStart=app.indexOf("    if(boot.mode==='shared'&&boot.user.role==='owner'){");
const driveEnd=app.indexOf("\n  }else if(view==='members')",driveStart);
if(driveStart<0||driveEnd<0)throw Error('Drive management block changed');
app=app.slice(0,driveStart)+`    if(boot.mode==='shared'&&boot.user.role==='owner'&&boot.driveFolderUrl){const link=document.createElement('a');link.className='primary';link.textContent='開啟名片雲端資料夾';link.href=boot.driveFolderUrl;link.target='_blank';link.rel='noopener';$('#driveActions').append(link);}`+app.slice(driveEnd);
app=app.replaceAll('公司共用資料庫；連接管理員 Drive 後，儲存名片會自動同步照片。','Google 試算表共用資料庫；照片直接存入管理員 Google Drive。').replaceAll('Google 登入、Drive','Google 登入、Drive').replaceAll('已設定，需實測','已設定').replaceAll('由管理員授權，在管理員雲端建立「公司名片庫」，員工不需登入管理員帳號。','照片直接保存至管理員的「公司名片庫」，員工透過 App 讀取，不共用管理員密碼。').replaceAll('資料庫與 Google Drive 照片是分開保存。Drive 照片同步不代表完整資料庫備份。','名片欄位保存在 Google 試算表，照片在 Drive。請定期下載包含文字與照片的完整備份。');
const bridge=`
function gasCall(name,args){return new Promise((resolve,reject)=>{const r=google.script.run.withSuccessHandler(result=>{if(!result?.ok){reject(Object.assign(new Error(result?.error||'Google 服務暫時無法完成操作。'),result));return;}resolve(result.data);}).withFailureHandler(()=>reject(new Error('無法連接 Google 共用服務，請重新整理後再試。')));if(name==='api')r.api(...args);else if(name==='beginLogin')r.beginLogin();else if(name==='pollLogin')r.pollLogin(...args);else reject(new Error('不支援的操作。'));});}
async function signInGoogle(e){e.preventDefault();const popup=window.open('about:blank','card-google-login');try{const flow=await gasCall('beginLogin',[]);if(!popup)throw Error('請允許登入分頁彈出後再試。');popup.location.href=flow.url;const deadline=Date.now()+300000;while(Date.now()<deadline){await new Promise(r=>setTimeout(r,1800));const result=await gasCall('pollLogin',[flow.flow,flow.secret]);if(result.token){sessionStorage.setItem('card-session',result.token);try{popup.close();}catch{}location.reload();return;}}throw Error('登入逾時，請再試一次。');}catch(err){try{popup?.close();}catch{}notice($('#pageError'),err.message,'error');}}
`;
let model=(await read('../v2/public/model.js')).replace(/^export /gm,'');
let html=await read('../v2/public/index.html');
const css=await read('../v2/public/style.css');
html=html.replace('<link rel="stylesheet" href="./style.css">',()=>'<style>'+css+'</style>')
  .replace('<script type="module" src="./app.js"></script>',()=>'<script type="module">'+(bridge+'\n'+model+'\n'+app).replaceAll('</script','<\\/script')+'</script>')
  .replace('content="browser-demo"','content="google-shared"').replaceAll('v2 試用版','Google 共用版').replaceAll('試用工作空間','公司工作空間');
await writeFile(new URL('./Index.html',import.meta.url),html);
console.log('Built google/Index.html');
