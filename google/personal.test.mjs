import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext,Script} from 'node:vm';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const code=(await readFile(new URL('./Code.gs',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('./Login.gs',import.meta.url),'utf8')),OWNER='sq087786789@gmail.com';
function fixture(email=OWNER){
 const data=[['type','id','json']],p=new Map([['DATABASE_ID','db'],['FOLDER_ID','folder']]);const stats={opens:0,reads:0,writes:0,flushes:0,locks:0,unlocks:0,driveCreates:0};
 const sheet={getLastRow:()=>data.length,getRange:(r,c,rows,cols)=>({getValues:()=>{stats.reads++;return data.slice(r-1,r-1+rows).map(x=>x.slice(c-1,c-1+cols));},setValues:vals=>{stats.writes++;vals.forEach((v,i)=>data[r-1+i]=v);}})};
 const ctx=createContext({console,Date,JSON,Uint8Array,Session:{getActiveUser:()=>({getEmail:()=>email}),getEffectiveUser:()=>({getEmail:()=>OWNER})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>p.get(k)||null,setProperty:(k,v)=>p.set(k,v),deleteProperty:k=>p.delete(k),getProperties:()=>Object.fromEntries(p)})},SpreadsheetApp:{openById:()=>{stats.opens++;return {getSheets:()=>[sheet]};},flush:()=>stats.flushes++},LockService:{getScriptLock:()=>({waitLock:()=>stats.locks++,releaseLock:()=>stats.unlocks++})},CacheService:{getScriptCache:()=>({get:()=>null,put:()=>{}})},Utilities:{getUuid:randomUUID,DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>[...createHash('sha256').update(s).digest()],base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),base64Decode:s=>[...Buffer.from(s,'base64')],base64Encode:b=>Buffer.from(b).toString('base64'),newBlob:(b,m)=>({b,m})},Drive:{Files:{create:()=>{stats.driveCreates++;return{id:'private-photo'};}}}});
 runInContext(code,ctx);return {ctx,p,data,stats,api:(path,method='GET',input={})=>ctx.api('',path,method,input)};
}
test('only the active Google owner is accepted; stale app tokens and execute-as-owner cannot impersonate a visitor',()=>{for(const email of ['', 'staff@example.com']){const a=fixture(email);a.p.set('session.'+a.ctx.hash_('old-token'),JSON.stringify({email:OWNER,expires:Date.now()+60000}));for(const [path,method]of [['/api/bootstrap','GET'],['/api/cards','GET'],['/api/photos/id','GET'],['/api/cards','POST'],['/api/backup','GET']])assert.equal(a.ctx.api('old-token',path,method,{}).status,403);assert.equal(a.stats.opens,0);assert.equal(a.stats.driveCreates,0);assert.throws(()=>a.ctx.initialize(),/管理員/);}});
test('owner Google session still opens directly; retired shared login functions stay removed',()=>{const a=fixture();assert.equal(a.api('/api/bootstrap').data.user.email,OWNER);assert.equal(a.api('/api/bootstrap').data.deployment,'google-personal');assert.equal(typeof a.ctx.beginLogin,'undefined');assert.equal(typeof a.ctx.pollLogin,'undefined');});
test('bootstrap returns contacts in one request and opens and reads the sheet only once',()=>{const a=fixture();a.api('/api/cards','POST',{name:'保留的名片'});a.stats.opens=a.stats.reads=0;const b=a.api('/api/bootstrap');assert.equal(b.data.initialCards[0].name,'保留的名片');assert.equal(a.stats.opens,1);assert.equal(a.stats.reads,1);});
test('saving contact and audit shares one sheet read and returns refreshed contacts without a second RPC',()=>{const a=fixture();a.api('/api/cards','POST',{name:'先前名片'});a.stats.opens=a.stats.reads=a.stats.flushes=0;const result=a.api('/api/cards','POST',{name:'新增名片',email:'fake@example.com'});assert.equal(result.ok,true);assert.equal(result.data.initialCards.length,2);assert.equal(a.stats.opens,1);assert.equal(a.stats.reads,1);assert.equal(a.stats.flushes,1);assert.equal(a.stats.locks,a.stats.unlocks);});
test('personal mode refuses member additions and exposes no member directory',()=>{const a=fixture();assert.equal(a.api('/api/members','POST',{email:'staff@example.com'}).status,403);assert.equal(a.api('/api/members').status,404);assert.equal(a.data.length,1);});
test('concurrent revisions and normalized Taiwan duplicate phone numbers are still checked',()=>{const a=fixture(),c=a.api('/api/cards','POST',{name:'原名片',mobile:'0912-345-678'}).data;assert.equal(a.api('/api/cards','POST',{name:'重複',phone:'+886912345678'}).status,409);assert.equal(a.api('/api/cards/'+c.id,'PUT',{name:'新版',revision:1}).ok,true);assert.equal(a.api('/api/cards/'+c.id,'PUT',{name:'舊版',revision:1}).status,409);assert.equal(a.api('/api/cards').data[0].name,'新版');});
test('private photo writes validate image bytes and retain the same Drive folder',()=>{const a=fixture();assert.equal(a.api('/api/photos','POST',{dataUrl:'data:image/png;base64,YmFk'}).status,400);assert.equal(a.stats.driveCreates,0);const photo=a.api('/api/photos','POST',{dataUrl:'data:image/png;base64,'+Buffer.from([137,80,78,71,13,10,26,10,0]).toString('base64')}).data;const saved=a.api('/api/cards','POST',{name:'照片名片',photoIds:[photo.id]});assert.equal(saved.ok,true);assert.equal(a.stats.driveCreates,1);assert.equal(a.p.get('FOLDER_ID'),'folder');assert.equal(a.p.get('DATABASE_ID'),'db');});
test('trash is reversible and stale revisions cannot delete newer data',()=>{const a=fixture(),c=a.api('/api/cards','POST',{name:'可還原'}).data;assert.equal(a.api('/api/cards/'+c.id,'DELETE',{revision:0}).status,409);assert.equal(a.api('/api/cards/'+c.id,'DELETE',{revision:1}).ok,true);assert.equal(a.api('/api/cards').data.length,0);assert.equal(a.api('/api/cards?trash=1').data.length,1);assert.equal(a.api('/api/cards/'+c.id+'/restore','POST',{revision:2}).ok,true);assert.equal(a.api('/api/cards').data.length,1);});
function visionFixture(){const a=fixture();a.p.set('VISION_ENABLED','true');a.p.set('VISION_API_KEY','fake-vision-key');a.ctx.put_('photo','p',{fileId:'private-photo',mime:'image/png'});a.ctx.driveBytes_=file=>[1,2,3];a.calls=[];a.ctx.UrlFetchApp={fetch:(url,opts)=>{a.calls.push({url,...opts,payload:JSON.parse(opts.payload)});return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({responses:a.calls.at(-1).payload.requests.map(()=>({fullTextAnnotation:{text:'測試公司\n王小明\n業務經理\nM: 0900-000-001\ndemo@example.com'}}))})};}};return a;}
function loginFixture(profile={sub:'owner-sub',email:OWNER,email_verified:true}){
 const a=fixture('');a.p.set('GOOGLE_CLIENT_ID','fake-client');a.p.set('GOOGLE_CLIENT_SECRET','fake-secret');a.calls=[];
 a.ctx.UrlFetchApp={fetch:(url,options)=>{a.calls.push({url,options});return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(url.endsWith('/token')?{access_token:'mock-google-access'}:profile)};}};
 a.flow=()=>a.ctx.beginPersonalLogin().data;return a;
}
test('remote POST requires a verified token even when executed in the owner Google session',()=>{
 const a=fixture();a.ctx.ContentService={MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})};
 const post=q=>a.ctx.doPost({postData:{contents:JSON.stringify(q)}});
 assert.equal(post({action:'api',path:'/api/backup'}).status,403);assert.equal(a.stats.reads,0);
 assert.equal(post({action:'api',token:'forged',path:'/api/cards'}).status,403);assert.equal(a.stats.reads,0);
 assert.equal(post({action:'unknown'}).status,404);
 const token='verified-session';a.p.set('personalSession.'+a.ctx.hash_(token),JSON.stringify({email:OWNER,sub:'owner',expires:Date.now()+60000}));
 assert.equal(post({action:'api',token,path:'/api/bootstrap'}).data.user.email,OWNER);
});
test('OAuth has PKCE, a fixed callback and email-only scopes; polling requires a separate secret',()=>{
 const a=loginFixture(),f=a.flow(),url=new URL(f.url),stored=JSON.parse(a.p.get('personalFlow.'+f.flow));
 assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('scope'),'openid email');
 assert.equal(url.searchParams.get('code_challenge'),a.ctx.hash_(stored.verifier));assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 assert.equal(url.searchParams.get('redirect_uri'),'https://script.google.com/macros/s/AKfycbxW7uPyY5JyhaTZHYGPrg9z_OKdDaNAPYlXqPADlS95al-1PKyuP5YZZ7JS_2XW91qU/exec');
 assert.equal(url.searchParams.has('client_secret'),false);assert.equal(a.ctx.pollPersonalLogin(f.flow,'wrong-secret').status,403);assert.equal(a.stats.reads,0);
});
test('only verified owner OAuth can issue a new session; legacy tokens stay invalid',()=>{
 for(const profile of [{sub:'other',email:'other@example.com',email_verified:true},{sub:'owner',email:OWNER,email_verified:false},{email:OWNER,email_verified:true}]){
  const a=loginFixture(profile),f=a.flow();a.ctx.completePersonalLogin_({state:f.flow,code:'code'});
  assert.equal(a.ctx.pollPersonalLogin(f.flow,f.secret).status,403);assert.equal([...a.p.keys()].some(k=>k.startsWith('personalSession.')),false);assert.equal(a.stats.reads,0);
 }
 const a=loginFixture(),f=a.flow();a.ctx.completePersonalLogin_({state:f.flow,code:'code'});
 const result=a.ctx.pollPersonalLogin(f.flow,f.secret);assert.equal(result.ok,true);const token=result.data.token;
 assert.equal(a.ctx.api(token,'/api/bootstrap','GET',{}).data.user.email,OWNER);
 assert.equal(a.ctx.api('forged','/api/cards','GET',{}).status,403);assert.equal(a.ctx.pollPersonalLogin(f.flow,f.secret).status,403);
 const storedKey='personalSession.'+a.ctx.hash_(token);assert.equal(JSON.parse(a.p.get(storedKey)).email,OWNER);
 assert.ok(!a.p.get(storedKey).includes('mock-google-access'));assert.equal(a.calls[0].options.payload.code_verifier.length,72);
 assert.equal(a.ctx.api(token,'/api/logout','POST',{}).ok,true);assert.equal(a.ctx.api(token,'/api/cards','GET',{}).status,403);
});
test('expired, replayed and unknown OAuth callbacks never exchange tokens',()=>{
 const a=loginFixture();assert.throws(()=>a.ctx.completePersonalLogin_({state:'unknown',code:'code'}));assert.equal(a.calls.length,0);
 let f=a.flow(),key='personalFlow.'+f.flow,record=JSON.parse(a.p.get(key));record.expires=Date.now()-1;a.p.set(key,JSON.stringify(record));
 assert.throws(()=>a.ctx.completePersonalLogin_({state:f.flow,code:'code'}));assert.equal(a.calls.length,0);
 f=a.flow();a.ctx.completePersonalLogin_({state:f.flow,code:'code'});const calls=a.calls.length;
 assert.throws(()=>a.ctx.completePersonalLogin_({state:f.flow,code:'code'}));assert.equal(a.calls.length,calls);
 const token=a.ctx.pollPersonalLogin(f.flow,f.secret).data.token;key='personalSession.'+a.ctx.hash_(token);record=JSON.parse(a.p.get(key));record.expires=Date.now()-1;a.p.set(key,JSON.stringify(record));
 const reads=a.stats.reads;assert.equal(a.ctx.api(token,'/api/cards','GET',{}).status,403);assert.equal(a.stats.reads,reads);
});
test('tax ID preserves leading zeros through saving, editing and backup; legacy cards stay compatible',()=>{
 const a=fixture(),c=a.api('/api/cards','POST',{company:'虛構測試公司',taxId:'０１２３４５６７'}).data;
 assert.equal(c.taxId,'01234567');
 assert.equal(a.api('/api/cards/'+c.id,'PUT',{company:c.company,taxId:c.taxId,revision:1}).ok,true);
 assert.equal(a.api('/api/backup').data.cards[0].taxId,'01234567');
 assert.equal(a.api('/api/cards','POST',{name:'舊名片'}).data.taxId,'');
 assert.equal(a.api('/api/cards','POST',{name:'格式錯誤',taxId:'123'}).status,400);
});
test('OCR extracts a labelled tax ID without guessing from an unlabelled number',()=>{
 const a=fixture();assert.equal(a.ctx.visionFields_('測試公司\n統一編號：０１２３４５６７').taxId,'01234567');
 assert.equal(a.ctx.visionFields_('測試公司\nTax ID: 12345678').taxId,'12345678');
 assert.equal(a.ctx.visionFields_('測試公司\n12345678').taxId,'');
});
test('unconfigured Vision cannot fall back to Gemini and does not alter contacts',()=>{const a=fixture();a.api('/api/cards','POST',{name:'不被覆蓋'});a.p.set('GEMINI_API_KEY','old');a.p.set('GEMINI_MODEL','old');assert.equal(a.api('/api/bootstrap').data.ocrReady,false);assert.equal(a.api('/api/ocr','POST',{photoIds:['p']}).status,503);assert.equal(a.api('/api/cards').data[0].name,'不被覆蓋');});
test('Vision sends one feature per distinct image, server-only key, and caches identical bytes',()=>{const a=visionFixture();let r=a.api('/api/ocr','POST',{photoIds:['p']});assert.equal(r.ok,true);assert.equal(r.data.name,'王小明');assert.equal(r.data.email,'demo@example.com');assert.equal(r.data.usage.used,1);assert.equal(a.calls[0].url,'https://vision.googleapis.com/v1/images:annotate');assert.deepEqual(a.calls[0].payload.requests[0].features,[{type:'DOCUMENT_TEXT_DETECTION'}]);assert.equal(a.calls[0].headers['x-goog-api-key'],'fake-vision-key');a.ctx.put_('photo','other',{fileId:'same-bytes',mime:'image/png'});r=a.api('/api/ocr','POST',{photoIds:['other','p']});assert.equal(r.ok,true);assert.equal(a.calls.length,1);assert.equal(r.data.usage.used,1);assert.equal(a.api('/api/bootstrap').data.ocrProvider,'Cloud Vision');});
test('persistent quota reserves before network, refuses an oversized batch and the 901st unit',()=>{const a=visionFixture();a.ctx.put_('visionUsage','prior',{at:new Date().toISOString(),units:899});a.ctx.put_('photo','back',{fileId:'back',mime:'image/png'});a.ctx.driveBytes_=file=>file==='back'?[4,5,6]:[1,2,3];assert.equal(a.api('/api/ocr','POST',{photoIds:['p','back']}).status,429);assert.equal(a.calls.length,0);assert.equal(a.api('/api/ocr','POST',{photoIds:['p']}).ok,true);assert.equal(a.api('/api/ocr','POST',{photoIds:['back']}).status,429);assert.equal(a.calls.length,1);assert.equal(a.api('/api/ocr','POST',{photoIds:['p']}).ok,true);assert.equal(a.calls.length,1);assert.equal(a.stats.locks,a.stats.unlocks);});
test('rolling 32-day quota does not reset at calendar-month boundary',()=>{const a=visionFixture();a.ctx.put_('visionUsage','recent',{at:new Date(Date.now()-31*86400000).toISOString(),units:900});assert.equal(a.api('/api/ocr','POST',{photoIds:['p']}).status,429);a.ctx.put_('visionUsage','recent',{at:new Date(Date.now()-33*86400000).toISOString(),units:900});assert.equal(a.api('/api/ocr','POST',{photoIds:['p']}).ok,true);assert.equal(a.api('/api/bootstrap').data.ocrUsage.used,1);});
test('unknown failures and empty responses consume reservations without automatic retries',()=>{for(const kind of ['network','forbidden','partial','empty','invalid']){const a=visionFixture();let calls=0;a.ctx.UrlFetchApp.fetch=()=>{calls++;if(kind==='network')throw Error('network interrupted');return{getResponseCode:()=>kind==='forbidden'?403:200,getContentText:()=>kind==='invalid'?'invalid':JSON.stringify({responses:kind==='partial'?[{error:{code:13}}]:[{}]})};};const r=a.api('/api/ocr','POST',{photoIds:['p']});assert.equal(r.ok,false);assert.equal(a.api('/api/bootstrap').data.ocrUsage.used,1);assert.equal(calls,1);assert.equal(a.ctx.list_('visionText').length,0);}});
test('Taiwan card parser separates contact fields, preserves raw text and flags ambiguous fields',()=>{const a=fixture();const text='範例科技股份有限公司\n王小明 業務襄理\n手機: +886 912-345-678\nTEL: 02-2345-6789 FAX: 02-2345-6790\n分機: 123\nEmail: demo@example.com\nhttps://example.com\nLINE ID: demo.user\n地址: 台北市中正區測試路一號';const r=a.ctx.visionFields_(text);assert.equal(r.name,'王小明');assert.equal(r.title,'業務襄理');assert.equal(r.company,'範例科技股份有限公司');assert.equal(r.mobile,'+886 912-345-678');assert.equal(r.phone,'02-2345-6789');assert.equal(r.fax,'02-2345-6790');assert.equal(r.extension,'123');assert.equal(r.email,'demo@example.com');assert.equal(r.website,'https://example.com');assert.equal(r.line,'demo.user');assert.equal(r.address,'台北市中正區測試路一號');assert.equal(r.rawText,text);assert.ok(r.uncertainFields.includes('name'));const uncertain=a.ctx.visionFields_('王小明\n李小華\n0900-000-001');assert.equal(uncertain.name,'');});

test('personal frontend has an owner-only login fallback, tab-scoped session and deferred photos',async()=>{execFileSync(process.execPath,[new URL('./build.mjs',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')]);const html=await readFile(new URL('./Index.html',import.meta.url),'utf8'),js=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];assert.doesNotThrow(()=>new Script('(async()=>{'+js+'\n})()'));assert.ok(js.includes('beginPersonalLogin'));assert.ok(js.includes('card-personal-session-v1'));assert.ok(!js.includes('localStorage'));assert.ok(js.includes('.api(personalToken,path,method,data)'));assert.ok(html.includes('id="loginGate"'));assert.ok(!js.includes('location.reload()'));assert.ok(js.includes('IntersectionObserver'));assert.ok(js.includes('firstLoadCards'));assert.ok(!js.includes('setInterval('));assert.ok(html.includes('id="personalCamera"'));assert.ok(!html.includes('testPhotoConsent'));assert.ok(html.includes('Google Cloud Vision'));assert.ok(!html.includes('虛構測試名片'));assert.ok(!js.includes('Google Gemini API'));assert.ok(js.includes('shouldOCR=false'));});

test('fictional fixture splits a name and company printed on the same line',()=>{const a=fixture(),r=a.ctx.visionFields_('測試名片(虛構)\n王小明 / 測試公司\n0900-000-001\ndemo@example.com');assert.equal(r.name,'王小明');assert.equal(r.company,'測試公司');});

test('GitHub frontend uses cookie-free simple POST; callback clears the URL and cannot receive a session',async()=>{
 execFileSync(process.execPath,[new URL('./build-web.mjs',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')]);
 const html=await readFile(new URL('./Library.html',import.meta.url),'utf8'),callback=await readFile(new URL('../oauth-callback.js',import.meta.url),'utf8');
 assert.ok(html.includes('const personalRemote=true;'));assert.ok(html.includes("credentials:'omit'"));assert.ok(html.includes("'Content-Type':'text/plain;charset=UTF-8'"));
 assert.ok(!html.includes('GOOGLE_CLIENT_SECRET'));assert.ok(!html.includes('VISION_API_KEY'));
 assert.ok(callback.includes('history.replaceState'));assert.ok(callback.includes("credentials:'omit'"));assert.ok(!callback.includes('sessionStorage'));
 new Script(callback);
});
