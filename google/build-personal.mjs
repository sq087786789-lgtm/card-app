import {readFile,writeFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
let app=await read('../v2/public/app.js');
function replace(pattern,value){if(!app.match(pattern))throw Error('Frontend changed: '+pattern);app=app.replace(pattern,()=>value);}
replace(/^import .*\r?\n/,'');
replace(/const browserDemo=.*?;/,'const browserDemo=false;');
replace(/const demo=browserDemo .*?;/,'const demo=null;');
replace(/async function api\(path,method='GET',data\)\{[\s\S]*?\n\}/,`async function api(path,method='GET',data){if(path==='/api/cards'&&firstLoadCards!==null){const result=firstLoadCards;firstLoadCards=null;return result;}const result=await gasCall(path,method,data||{});if(Array.isArray(result?.initialCards))firstLoadCards=result.initialCards;return result;}`);
replace(/async function photoUrl\(id\)\{[^\n]+\}/,`async function photoUrl(id){if(!id)return '';if(!photoCache.has(id))photoCache.set(id,api('/api/photos/'+id).catch(e=>{photoCache.delete(id);throw e;}));return await photoCache.get(id);}`);
replace(/if\(c.photoIds\?\.length\)\{photoUrl\(c.photoIds\[0\]\)[^\n]+/,`if(c.photoIds?.length){const img=article.querySelector('img');img.dataset.photoId=c.photoIds[0];observePhoto(img);}`);
replace(/shouldOCR=boot\.ocrReady;/,'shouldOCR=false;');
replace(/\$\('#logout'\)\.onclick=async\(\)=>\{try\{await api\('\/api\/logout','POST',\{\}\);location.reload\(\);\}catch\(e\)\{toast\(e.message\);\}\};/,"$('#logout').onclick=()=>{};");
// Opening an existing contact should show fields immediately, even while its photo loads.
replace(/await updatePhoto\(\);\$\('#editor'\)\.showModal\(\);/,`$('#editor').showModal();updatePhoto().catch(e=>notice($('#ocrNotice'),e.message,'warning'));`);
// Single-user data is refreshed after mutations or on demand, without a background polling loop.
app=app.split('\n').filter(line=>!line.startsWith('setInterval(()=>{if(boot?.mode')).join('\n');
const bootStart=app.lastIndexOf("try{boot=await api('/api/bootstrap')");if(bootStart<0)throw Error('Bootstrap changed');
app=app.slice(0,bootStart)+`$('#loginRetry').onclick=()=>{clearPendingPersonalLogin();startPersonal();};await startPersonal();
$('#personalCamera').onclick=()=>{openEditor();$('#cameraFile').click();};$('#personalRefresh').onclick=async()=>{photoCache.clear();try{await reload();toast('已更新');}catch(e){notice($('#pageError'),e.message,'error');}};
`;
const driveStart=app.indexOf("    if(boot.mode==='shared'&&boot.user.role==='owner'){");
const driveEnd=app.indexOf("\n  }else if(view==='members')",driveStart);if(driveStart<0||driveEnd<0)throw Error('Settings changed');
app=app.slice(0,driveStart)+`    if(boot.driveFolderUrl){const a=document.createElement('a');a.className='secondary';a.textContent='開啟我的 Drive 資料夾';a.href=boot.driveFolderUrl;a.target='_blank';a.rel='noopener';$('#driveActions').append(a);}`+app.slice(driveEnd);
app=app.replaceAll('選擇照片後，可辨識正反面的聯絡資訊。','使用 Google Cloud Vision 讀取真實名片；辨識後請核對欄位。').replaceAll('公司共用資料庫；連接管理員 Drive 後，儲存名片會自動同步照片。','你的名片欄位在私人試算表，照片直接保存在私人 Drive。').replaceAll('由管理員授權，在管理員雲端建立「公司名片庫」，員工不需登入管理員帳號。','使用既有私人名片資料夾，照片不公開。').replaceAll('正式版每位同事使用自己的帳號；只有核准帳號能登入。','直接使用你的 Google 登入狀態，只有本人能開啟。').replaceAll('已設定，需實測','已設定').replaceAll('公司通訊錄','我的通訊錄').replaceAll('Google Gemini API','Google Cloud Vision API').replaceAll('共用服務','私人服務');
const bridge=`
let firstLoadCards=null;
const personalRemote=false;
const personalBackend='https://script.google.com/macros/s/AKfycbxW7uPyY5JyhaTZHYGPrg9z_OKdDaNAPYlXqPADlS95al-1PKyuP5YZZ7JS_2XW91qU/exec';
async function remoteRpc(action,body){
  let r;try{r=await fetch(personalBackend,{method:'POST',credentials:'omit',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action,...body})});}catch{throw Error('Google 連線失敗，請重新整理後重試。');}
  let result;try{result=await r.json();}catch{throw Error('Google 未回傳可讀資料，請稍後重試。');}
  if(!r.ok||!result?.ok)throw Object.assign(Error(result?.error||'暫時無法開啟名片庫。'),result);
  return result.data;
}
function gasCall(path,method,data){if(personalRemote)return remoteRpc('api',{token:personalToken,path,method,input:data});return new Promise((resolve,reject)=>google.script.run.withSuccessHandler(r=>{if(!r?.ok){reject(Object.assign(new Error(r?.error||'無法讀取名片庫。'),r));return;}resolve(r.data);}).withFailureHandler(()=>reject(Error('Google 連線暫時失敗，請重新整理。'))).api(personalToken,path,method,data));}
const photoQueue=[];let photoJobs=0;
function drainPhotos(){while(photoJobs<2&&photoQueue.length){const img=photoQueue.shift();if(!img.isConnected)continue;photoJobs++;photoUrl(img.dataset.photoId).then(url=>{if(img.isConnected)img.src=url;}).catch(()=>{img.alt='照片稍後可重試';}).finally(()=>{photoJobs--;drainPhotos();});}}
const photoObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){photoObserver.unobserve(e.target);photoQueue.push(e.target);}drainPhotos();},{rootMargin:'120px'}):null;
function observePhoto(img){if(photoObserver)photoObserver.observe(img);else{photoQueue.push(img);drainPhotos();}}
`;
const loginClient=await read('./login-client.js');
const model=(await read('../v2/public/model.js')).replace(/^export /gm,'');
const css=await read('../v2/public/style.css');
let html=await read('../v2/public/index.html');
const extraCss=`.sidebar,.topbar,.mode-banner,footer,#logout{display:none!important}.workspace{margin-left:0!important}.personal-header{display:flex;align-items:center;justify-content:space-between;gap:16px;max-width:1120px;margin:auto;padding:24px 28px}.personal-header strong{font-size:22px}.personal-header small{display:block;color:var(--muted);font-size:12px}.personal-actions{display:flex;gap:10px;align-items:center}.personal-actions details{position:relative}.personal-actions summary{cursor:pointer;list-style:none;padding:10px}.personal-menu{position:absolute;right:0;top:44px;z-index:20;min-width:180px;background:white;padding:12px;border:1px solid var(--line);border-radius:14px;box-shadow:0 12px 32px #213c3420}.personal-menu button{display:block;width:100%;text-align:left;margin:4px 0}main{max-width:1120px;margin:auto;padding-top:12px}.summary{display:none}.page-heading{margin-bottom:22px}.page-heading .eyebrow{display:none}.page-heading h1{font-size:28px}.page-heading p{font-size:14px}.personal-consent{display:flex;gap:8px;font-size:12px;color:#795d2c;margin:12px 0}.personal-consent input{flex:none}.toolbar-buttons{display:none}.personal-header [data-view=all]{background:none;border:0;color:var(--ink);cursor:pointer;text-align:left;padding:0}@media(max-width:650px){.personal-header{padding:18px 18px 10px}.personal-header strong{font-size:20px}.personal-actions{gap:2px}.personal-actions .primary{padding:11px 15px}main{padding:16px}.page-heading{align-items:center}.page-heading h1{font-size:25px}.page-heading p{max-width:220px}.card-grid{grid-template-columns:1fr}.card-photo{height:160px}}`;
const header=`<header class="personal-header"><button data-view="all"><strong>我的名片</strong><small id="personalStatus">正在開啟私人名片庫…</small></button><div class="personal-actions"><button class="primary" id="personalCamera">◎ 拍名片</button><details><summary aria-label="更多功能">⋯</summary><div class="personal-menu"><button class="text-btn" id="personalRefresh">重新整理</button><button class="text-btn" data-view="settings">備份與匯入</button><button class="text-btn" data-view="trash">回收筒</button><button class="text-btn" data-view="all">回到名片</button></div></details></div></header>`;
const loginGate='<section id="loginGate" style="max-width:540px;margin:10vh auto;padding:28px"><h1>我的名片</h1><p>私人名片庫，僅限 sq087786789@gmail.com 使用。</p><p id="loginMessage" role="status">正在確認登入…</p><a id="personalLogin" class="primary" target="_blank" rel="noopener noreferrer" hidden>使用 Google 帳號登入</a><button id="loginRetry" type="button" class="text-btn">重新準備登入</button></section>';
html=html.replace('<body>','<body data-auth="pending">'+loginGate+header).replace('<link rel="stylesheet" href="./style.css">',()=>'<style>'+css+extraCss+'body[data-auth=pending] .workspace,body[data-auth=pending] .personal-header{display:none!important}#loginGate[hidden],#personalLogin[hidden]{display:none!important}</style>');
const visionNotice='<p class="personal-consent">按辨識會將照片傳送至 Google Cloud Vision。程式最多送出 900 張照片／滾動 32 天，達上限即停止；相同照片重用結果。</p>';
html=html.replace('<button type="button" class="primary full" id="ocrBtn">',visionNotice+'<button type="button" class="primary full" id="ocrBtn">');
html=html.replace('<script type="module" src="./app.js"></script>',()=>'<script type="module">'+(bridge+'\n'+loginClient+'\n'+model+'\n'+app).replaceAll('</script','<\\/script')+'</script>').replace('content="browser-demo"','content="google-personal"').replace('<title>名片共用庫</title>','<title>我的名片</title>').replace('讓每次相遇，都找得到。','拍下名片，隨時找得到。').replace('把名片整理好，下次需要聯絡時，不必再翻找。','拍照保存，或直接搜尋姓名、公司與電話。').replaceAll('Google 共用版','Google 個人版');
await writeFile(new URL('./Index.html',import.meta.url),html);console.log('Built Google personal app');
