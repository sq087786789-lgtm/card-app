/** All private helpers end in _ so google.script.run cannot invoke them. */
const OWNER_ = 'sq087786789@gmail.com';
const FIELDS_ = ['name','company','title','mobile','phone','extension','fax','email','website','line','address','category','note','rawText'];
function props_(){return PropertiesService.getScriptProperties();}
function id_(){return Utilities.getUuid()+Utilities.getUuid();}
function hash_(s){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s)).replace(/=+$/,'');}
function fail_(status,error,extra){throw Object.assign(new Error(error),{status:status,extra:extra||{}});}
function locked_(fn){const l=LockService.getScriptLock();l.waitLock(30000);try{const result=fn();SpreadsheetApp.flush();return result;}finally{l.releaseLock();}}
let requestStore_=null;
function rows_(){if(requestStore_)return requestStore_.rows;const id=props_().getProperty('DATABASE_ID');if(!id)fail_(503,'尚未初始化名片庫。');const sheet=SpreadsheetApp.openById(id).getSheets()[0],last=sheet.getLastRow();requestStore_={sheet:sheet,rows:last<2?[]:sheet.getRange(2,1,last-1,3).getValues().map((r,i)=>({type:r[0],id:String(r[1]),value:JSON.parse(r[2]),row:i+2}))};return requestStore_.rows;}
function put_(type,id,value){const rows=rows_(),old=rows.find(r=>r.type===type&&r.id===id),row=old?old.row:rows.length+2;requestStore_.sheet.getRange(row,1,1,3).setValues([[type,id,JSON.stringify(value)]]);if(old)old.value=value;else rows.push({type:type,id:id,value:value,row:row});}
function list_(type){return rows_().filter(r=>r.type===type).map(r=>Object.assign({id:r.id},r.value));}
function get_(type,id){return list_(type).find(r=>r.id===id)||null;}
function member_(email){return get_('member',email.toLowerCase());}
function audit_(actor,action,card){put_('audit',Utilities.getUuid(),{actor:actor,action:action,card_id:card||null,at:new Date().toISOString()});}
function session_(){const email=String(Session.getActiveUser().getEmail()||'').toLowerCase();if(email!==OWNER_)fail_(403,'這是私人名片庫，請使用 '+OWNER_+' 開啟。');return {email:email,role:'owner'};}
function admin_(s){if(s.role!=='owner')fail_(403,'這項操作需要管理員權限。');}
function purge_(){const p=props_();Object.entries(p.getProperties()).forEach(([k,v])=>{if(/^(flow|session)\./.test(k)){try{if(JSON.parse(v).expires<Date.now())p.deleteProperty(k);}catch{p.deleteProperty(k);}}});}
function rate_(key,max){const c=CacheService.getScriptCache(),k='rate.'+hash_(key+':'+Math.floor(Date.now()/60000));const n=Number(c.get(k)||0)+1;if(n>max)fail_(429,'操作太頻繁，請稍後再試。');c.put(k,String(n),70);}
function callGoogle_(url,options){const r=UrlFetchApp.fetch(url,Object.assign({muteHttpExceptions:true},options));if(r.getResponseCode()<200||r.getResponseCode()>=300)fail_(502,'Google 服務回應 '+r.getResponseCode()+'，資料仍保留，請稍後重試。');return JSON.parse(r.getContentText());}
function driveBytes_(file){const r=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(file)+'?alt=media',{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});if(r.getResponseCode()!==200)fail_(502,'照片讀取失敗，請稍後重試。');return r.getBlob().getBytes();}
function photoData_(id){const p=get_('photo',id);if(!p)fail_(404,'找不到照片。');return 'data:'+p.mime+';base64,'+Utilities.base64Encode(driveBytes_(p.fileId));}
/** Run only from the Apps Script editor as the project owner. Idempotent. */
function initialize(){requestStore_=null;if(Session.getActiveUser().getEmail().toLowerCase()!==OWNER_)throw new Error('請由管理員在指令碼編輯器執行初始化。');return setup_();}
function setup_(){
  if(Session.getEffectiveUser().getEmail().toLowerCase()!==OWNER_)throw new Error('請使用管理員帳號執行初始化。');
  return locked_(()=>{const p=props_();let folder=p.getProperty('FOLDER_ID');if(!folder){folder=Drive.Files.create({name:'公司名片庫',mimeType:'application/vnd.google-apps.folder'}).id;p.setProperty('FOLDER_ID',folder);}
    if(!p.getProperty('DATABASE_ID')){const ss=SpreadsheetApp.create('公司名片庫－共用資料');p.setProperty('DATABASE_ID',ss.getId());ss.getSheets()[0].appendRow(['type','id','json']);Drive.Files.update({},ss.getId(),null,{addParents:folder,removeParents:'root'});}
    put_('member',OWNER_,{email:OWNER_,role:'owner',active:true});return {initialized:true};});
}
function doGet(){try{session_();}catch{return HtmlService.createHtmlOutput('<meta name="viewport" content="width=device-width"><p>請使用 sq087786789@gmail.com 開啟此私人名片庫。</p>').setTitle('私人名片庫');}return HtmlService.createHtmlOutputFromFile('Index').setTitle('我的名片').addMetaTag('viewport','width=device-width,initial-scale=1');}
function safe_(fn){try{return {ok:true,data:fn()};}catch(e){return {ok:false,status:e.status||500,error:e.status?e.message:'服務暫時無法完成操作，請稍後重試。',...(e.extra||{})};}}
function api(token,path,method,input){requestStore_=null;return safe_(()=>{
  const s=session_();
  method=method||'GET';input=input||{};if(typeof path!=='string'||path.length>180||JSON.stringify(input).length>12*1024*1024)fail_(400,'要求格式不正確或照片過大。');
  if(path==='/api/bootstrap'&&method==='GET'){const p=props_();return {mode:'shared',deployment:'google-personal',user:s,googleReady:true,ocrReady:visionReady_(),driveConnected:!!p.getProperty('FOLDER_ID'),driveFolderUrl:'https://drive.google.com/drive/folders/'+p.getProperty('FOLDER_ID'),ocrProvider:'Cloud Vision',ocrUsage:visionUsage_(),pendingPhotos:0,initialCards:read_(s,'/api/cards')};}
  rate_(s.email,120);if(method==='GET')return read_(s,path);
  if(path==='/api/ocr'&&method==='POST')return ocr_(s,input);
  return locked_(()=>{session_();const result=write_(s,path,method,input,token);if(path.startsWith('/api/cards'))result.initialCards=read_(s,'/api/cards');return result;});
});}
function read_(s,path){
  if(path==='/api/cards')return list_('card').filter(c=>!c.deletedAt).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  if(path==='/api/cards?trash=1'){admin_(s);return list_('card').filter(c=>c.deletedAt);}
  if(path==='/api/members')fail_(404,'個人版沒有成員管理。');
  if(path==='/api/audit'){admin_(s);return list_('audit').sort((a,b)=>b.at.localeCompare(a.at)).slice(0,200);}
  if(path==='/api/backup'){admin_(s);return {format:'shared-card-library',version:2,cards:list_('card'),photos:list_('photo').filter(p=>p.cardId).map(p=>({id:p.id,dataUrl:photoData_(p.id)})),exportedAt:new Date().toISOString()};}
  const photo=path.match(/^\/api\/photos\/([\w-]+)$/);if(photo)return photoData_(photo[1]);fail_(404,'找不到這項資料。');
}
function clean_(v){const c={};FIELDS_.forEach(k=>c[k]=typeof v[k]==='string'?v[k].trim().slice(0,['note','rawText'].includes(k)?12000:500):'');if(!['未分類','客戶','供應商','合作夥伴','其他'].includes(c.category))c.category='未分類';c.reviewed=v.reviewed===true;if(![c.name,c.company,c.phone,c.mobile,c.email].some(Boolean))fail_(400,'請至少填寫姓名、公司、電話或 Email。');if(c.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))fail_(400,'Email 格式不正確。');if(c.website){if(!/^https?:\/\//i.test(c.website))c.website='https://'+c.website;if(!/^https?:\/\/[^\s/?#:@]+\.[^\s/?#:@]+(?::\d+)?(?:[/?#][^\s]*)?$/i.test(c.website))fail_(400,'網站網址格式不正確。');}return c;}
function save_(s,input,id){
  const old=id?get_('card',id):null;if(id&&(!old||old.deletedAt))fail_(404,'找不到名片。');if(old&&old.revision!==input.revision)fail_(409,'另一位同事已修改名片，請重新開啟。');const c=clean_(input),digits=v=>String(v||'').replace(/\D/g,'').replace(/^8860?/,'0');const phone=[c.phone,c.mobile].map(digits).filter(Boolean);
  const dup=list_('card').filter(x=>x.id!==id&&!x.deletedAt&&((c.email&&c.email.toLowerCase()===String(x.email||'').toLowerCase())||[x.phone,x.mobile].map(digits).some(v=>v&&phone.includes(v))));if(dup.length&&!input.allowDuplicate)fail_(409,'找到相同電話或 Email。',{duplicates:dup.map(x=>({id:x.id,name:x.name,company:x.company}))});
  const photos=Array.isArray(input.photoIds)?[...new Set(input.photoIds)].slice(0,2):old?.photoIds||[];photos.forEach(pid=>{const p=get_('photo',pid);if(!p||(p.cardId&&p.cardId!==id))fail_(400,'照片不存在或屬於其他名片。');});
  const now=new Date().toISOString();id=id||Utilities.getUuid();const result={...c,id:id,photoIds:photos,revision:(old?.revision||0)+1,createdAt:old?.createdAt||now,updatedAt:now,updatedBy:s.email,deletedAt:null};put_('card',id,result);photos.forEach(pid=>put_('photo',pid,{...get_('photo',pid),cardId:id}));audit_(s.email,old?'修改名片':'新增名片',id);return result;
}
function write_(s,path,method,v,token){
  if(path==='/api/logout')fail_(405,'私人版直接使用你的 Google 登入狀態。');
  if(path==='/api/cards'&&method==='POST')return save_(s,v);
  const c=path.match(/^\/api\/cards\/([\w-]+)(\/restore)?$/);if(c){if(method==='PUT'&&!c[2])return save_(s,v,c[1]);admin_(s);if(!((method==='DELETE'&&!c[2])||(method==='POST'&&c[2])))fail_(405,'不支援這項操作。');const old=get_('card',c[1]);if(!old||old.revision!==v.revision)fail_(409,'資料已更新，請重新整理。');put_('card',c[1],{...old,revision:old.revision+1,deletedAt:c[2]?null:new Date().toISOString()});audit_(s.email,c[2]?'還原名片':'移至回收筒',c[1]);return {ok:true};}
  if(path==='/api/members'&&method==='POST'){fail_(403,'個人版不開放新增成員。');admin_(s);const email=String(v.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email===OWNER_)fail_(400,'請輸入員工的 Google Email。');put_('member',email,{email:email,role:'staff',active:v.active!==false});audit_(s.email,(v.active===false?'停用員工 ':'核准員工 ')+email);return {ok:true};}
  if(path==='/api/photos'&&method==='POST'){
    const m=typeof v.dataUrl==='string'&&v.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);if(!m)fail_(400,'請選擇 JPG、PNG 或 WebP。');const b=Utilities.base64Decode(m[2]);if(b.length>8*1024*1024)fail_(413,'照片超過 8MB。');const u=b.slice(0,12).map(x=>(x+256)%256);if(!(m[1]==='image/jpeg'?u[0]===255&&u[1]===216&&u[2]===255:m[1]==='image/png'?JSON.stringify(u.slice(0,8))===JSON.stringify([137,80,78,71,13,10,26,10]):String.fromCharCode(...u.slice(0,4))==='RIFF'&&String.fromCharCode(...u.slice(8,12))==='WEBP'))fail_(400,'圖片內容與格式不符。');
    const id=Utilities.getUuid(),f=Drive.Files.create({name:id+({ 'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'}[m[1]]),parents:[props_().getProperty('FOLDER_ID')]},Utilities.newBlob(b,m[1]));put_('photo',id,{fileId:f.id,mime:m[1],createdAt:new Date().toISOString(),cardId:null});return {id:id};
  }
  if(path==='/api/drive/sync'){admin_(s);return {count:0,pending:0};}fail_(404,'不支援這項操作。');
}
// Keep Cloud Vision isolated from the former Gemini free-tier configuration.
// The key is server-only and must be restricted to vision.googleapis.com.
const VISION_LIMIT_=900, VISION_WINDOW_MS_=32*24*60*60*1000;
function visionReady_(){return props_().getProperty('VISION_ENABLED')==='true'&&!!props_().getProperty('VISION_API_KEY');}
function visionUsage_(){const since=Date.now()-VISION_WINDOW_MS_;const used=list_('visionUsage').filter(x=>Date.parse(x.at)>since).reduce((n,x)=>n+Number(x.units||0),0);return {used:used,limit:VISION_LIMIT_,windowDays:32,remaining:Math.max(0,VISION_LIMIT_-used)};}
function reserveVision_(units){return locked_(()=>{requestStore_=null;const usage=visionUsage_();if(units>usage.remaining)fail_(429,'已達名片庫的免費用量保護上限，暫停辨識；照片仍可保存及手動填寫。');put_('visionUsage',Utilities.getUuid(),{at:new Date().toISOString(),units:units});return usage;});}
function ocr_(s,v){
  rate_(s.email+':ocr',10);if(!visionReady_())fail_(503,'Cloud Vision 尚未完成設定，照片可先保存並手動填寫。');
  if(!Array.isArray(v.photoIds)||!v.photoIds.length||v.photoIds.length>2||v.photoIds.some(id=>typeof id!=='string'))fail_(400,'請先加入同一張名片的正面或反面照片。');
  const images=[...new Set(v.photoIds)].map(id=>{const photo=get_('photo',id);if(!photo)fail_(404,'照片不存在。');const content=Utilities.base64Encode(driveBytes_(photo.fileId));return {key:hash_('vision-document-v1:'+content),content:content};});
  const missing=[];for(const image of images){const cached=get_('visionText',image.key);if(cached)image.text=cached.text;else if(!missing.some(x=>x.key===image.key))missing.push(image);}
  if(missing.length){
    // Persist a conservative reservation BEFORE sending. Do not refund ambiguous
    // failures or automatically retry: Google may already have processed a request.
    reserveVision_(missing.length);
    const r=UrlFetchApp.fetch('https://vision.googleapis.com/v1/images:annotate',{method:'post',contentType:'application/json',headers:{'x-goog-api-key':props_().getProperty('VISION_API_KEY')},muteHttpExceptions:true,payload:JSON.stringify({requests:missing.map(x=>({image:{content:x.content},features:[{type:'DOCUMENT_TEXT_DETECTION'}],imageContext:{languageHints:['zh-TW','en']}}))})});
    const status=r.getResponseCode();if(status<200||status>=300){if(status===403)fail_(503,'Cloud Vision 未獲授權或帳務尚未啟用；照片仍保留，請管理員檢查設定。');if(status===429)fail_(429,'Google 辨識額度暫時不足，請稍後重試。');fail_(502,'Cloud Vision 暫時無法辨識，照片仍保留。');}
    let result;try{result=JSON.parse(r.getContentText());}catch{fail_(502,'Cloud Vision 回應無法讀取，照片仍保留。');}
    if(!Array.isArray(result.responses)||result.responses.length!==missing.length)fail_(502,'Cloud Vision 回應不完整，照片仍保留。');
    const texts=result.responses.map(x=>{if(x.error)fail_(502,'其中一面辨識失敗，照片仍保留，沒有自動重試。');const text=x.fullTextAnnotation?.text||x.textAnnotations?.[0]?.description||'';if(typeof text!=='string'||!text.trim())fail_(422,'未讀到名片文字，請確認照片清楚且方向正確。');if(text.length>12000)fail_(422,'文字過多，請一次拍攝同一張名片。');return text;});
    locked_(()=>{requestStore_=null;missing.forEach((x,i)=>put_('visionText',x.key,{text:texts[i],at:new Date().toISOString()}));});
    missing.forEach((x,i)=>x.text=texts[i]);for(const image of images)if(image.text===undefined)image.text=missing.find(x=>x.key===image.key).text;
  }
  const out=visionFields_(images.map(x=>x.text).join('\n'));if(!['name','company','mobile','phone','email'].some(k=>out[k]))fail_(422,'已讀到文字，但未能整理聯絡資訊。請查看照片並手動填寫。');out.usage=visionUsage_();return out;
}
// Deterministic field extraction. Never send OCR text to Gemini or any other AI.
// Ambiguous names, companies and addresses remain marked for human review.
function visionFields_(text){
  const out=Object.fromEntries(FIELDS_.map(k=>[k,'']));out.rawText=text.slice(0,12000);const lines=text.normalize('NFKC').split(/\r?\n/).flatMap(x=>/^[\u3400-\u9fff\s]+\s*[\/|]\s*[\u3400-\u9fff\s]+$/.test(x.trim())?x.split(/[\/|]/):[x]).map(x=>x.trim()).filter(Boolean);out.uncertainFields=[];
  const set=(key,value,uncertain=false)=>{value=String(value||'').trim().slice(0,500);if(!value)return;if(out[key]&&out[key]!==value){if(!out.uncertainFields.includes(key))out.uncertainFields.push(key);return;}out[key]=value;if(uncertain&&!out.uncertainFields.includes(key))out.uncertainFields.push(key);};
  const email=/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/ig;
  const company=/(?:股份有限公司|有限公司|企業社|工作室|實業社|商行|證券|銀行|事務所|協會|基金會|診所|醫院|大學|科技公司|測試公司)/;
  const title=/(?:總經理|副總經理|董事長|董事|經理|副理|襄理|主任|專員|工程師|設計師|業務|執行長|負責人|Manager|Director|Engineer|Sales|CEO)/i;
  for(const line of lines){
    for(const value of line.match(email)||[])set('email',value);
    const web=line.replace(email,'').match(/(?:https?:\/\/|www\.)[a-z0-9][a-z0-9./_?=&%#~+-]*|\b(?:[a-z0-9-]+\.)+(?:com|tw|net|org|io)(?:\/[a-z0-9./_?=&%#~+-]*)?/ig);for(const value of web||[])set('website',value.replace(/[.,;]+$/,''));
    const ext=line.match(/(?:分機|ext\.?|#)\s*[:：]?\s*(\d{1,6})/i);if(ext)set('extension',ext[1]);
    const lineId=line.match(/(?:LINE(?:\s*ID)?|賴)\s*[:：]\s*([a-z0-9_.-]+)/i);if(lineId)set('line',lineId[1]);
    const phones=[...line.matchAll(/(?:\+?886[\s().-]*|0)[2-9][\d\s().-]{6,18}\d/g)];
    for(const match of phones){const value=match[0],digits=value.replace(/\D/g,'').replace(/^8860?/,'0');if(digits.length<9||digits.length>10)continue;const prefix=line.slice(0,match.index).match(/(?:傳真|fax|電話|tel|phone|[TF])\s*[:：.]?\s*$/i)?.[0]||'';const key=/^(?:09)\d{8}$/.test(digits)?'mobile':/(?:傳真|fax|^F\b)/i.test(prefix)?'fax':'phone';set(key,value);}
    if(company.test(line)&&!/[\d@]/.test(line))set('company',line,true);
    const address=line.match(/(?:地址\s*[:：]?\s*)?((?:\d{3,6}\s*)?[台臺][北中南東](?:市|縣).+|(?:\d{3,6}\s*)?(?:新北|桃園|高雄|基隆|新竹|嘉義|苗栗|彰化|南投|雲林|屏東|宜蘭|花蓮|澎湖|金門|連江)(?:市|縣).+)/);if(address)set('address',address[1],true);
    if(title.test(line)&&!company.test(line)&&!/[\d@]/.test(line)){const m=line.match(/^([\u3400-\u9fff]{2,4})\s+(.+)$/);if(m&&title.test(m[2])){set('name',m[1],true);set('title',m[2],true);}else set('title',line,true);}
  }
  const candidates=lines.map(x=>x.replace(/^姓名\s*[:：]?\s*/,''));const explicit=lines.find(x=>/^姓名\s*[:：]/.test(x));if(explicit)set('name',explicit.replace(/^姓名\s*[:：]\s*/,''),true);
  if(!out.name){const names=candidates.filter(x=>/^[\u3400-\u9fff]{2,4}$/.test(x)&&!company.test(x)&&!title.test(x)&&!/(?:電話|手機|地址|傳真|名片|聯絡|服務|營業|公司|資訊|通訊|有限|股份)/.test(x));if(names.length===1)set('name',names[0],true);}
  if(!out.name){const english=lines.filter(x=>/^[A-Z][a-z]+(?:[ -][A-Z][a-z]+){1,3}$/.test(x)&&!title.test(x));if(english.length===1)set('name',english[0],true);}
  out.category='未分類';return out;
}
