import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../store.mjs';
import {cleanCard,duplicateCards,vcf,parseVCF} from '../public/model.js';
import {createApp,decodeImage} from '../server.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {Script} from 'node:vm';

test('field normalization preserves Taiwan numbers, separates phone types and blocks unsafe URL',()=>{
  const c=cleanCard({name:' 林小明 ',phone:'08-1234567',mobile:'0912-345-678',extension:'203',fax:'08-7654321',website:'example.com',email:'a@example.com'});
  assert.equal(c.name,'林小明');assert.equal(c.website,'https://example.com');assert.equal(c.extension,'203');assert.equal(c.fax,'08-7654321');
  assert.throws(()=>cleanCard({name:'A',website:'javascript:alert(1)'}));assert.throws(()=>cleanCard({name:'A',email:'bad'}));assert.throws(()=>cleanCard({}));
});
test('duplicates normalize Taiwan country code and compare all phone slots',()=>{
  const existing=[{id:'1',mobile:'0912-345-678',email:'LIN@example.com'},{id:'2',phone:'0800-100-200',deletedAt:'yesterday'}];
  assert.equal(duplicateCards({phone:'+886 912345678'},existing).length,1);assert.equal(duplicateCards({email:'lin@EXAMPLE.com'},existing).length,1);assert.equal(duplicateCards({id:'1',phone:'0912345678'},existing).length,0);assert.equal(duplicateCards({phone:'0800100200'},existing).length,0);
});
test('vCard supports typed phone numbers, escaped punctuation and line breaks',()=>{
  const rows=parseVCF(vcf([{name:'林小明',company:'甲;乙,公司',phone:'081234567',mobile:'0912345678',fax:'087654321',address:'屏東縣內埔鄉中正路1號',note:'第一行\n第二行'}]));
  assert.equal(rows[0].mobile,'0912345678');assert.equal(rows[0].fax,'087654321');assert.equal(rows[0].company,'甲;乙,公司');assert.equal(rows[0].note,'第一行\n第二行');assert.equal(rows[0].address,'屏東縣內埔鄉中正路1號');
});
test('saving, deduplication, optimistic locking, soft deletion and restore are durable',()=>{
  const s=new Store(':memory:');const c=s.save({name:'王先生',phone:'0912345678'},'owner');
  assert.throws(()=>s.save({name:'另一張',phone:'+886912345678'},'staff'),e=>e.status===409&&e.duplicates.length===1);
  const edited=s.save({...c,company:'公司'},'staff',c.id);assert.equal(edited.revision,2);
  assert.throws(()=>s.save({...c,name:'舊內容'},'owner',c.id),e=>e.status===409);
  assert.throws(()=>s.trash(c.id,1,'owner'),e=>e.status===409);
  s.trash(c.id,2,'owner');assert.equal(s.list().length,0);assert.equal(s.list(true).length,1);
  s.trash(c.id,3,'owner',true);assert.equal(s.get(c.id).revision,4);assert.equal(s.list().length,1);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM audit').get().n,4);s.close();
});
test('photo validation rejects SVG, MIME spoofing and oversized images',()=>{
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6nL8AAAAASUVORK5CYII=';
  assert.equal(decodeImage(png).mime,'image/png');assert.throws(()=>decodeImage('data:image/svg+xml;base64,PHN2Zz4='));assert.throws(()=>decodeImage('data:image/jpeg;base64,aGVsbG8='));assert.throws(()=>decodeImage('data:image/png;base64,'+Buffer.alloc(9*1024*1024).toString('base64')));
});
async function fixture(t,{demo=false,fetch:fetchMock,extraEnv={}}={}){
  const dir=await mkdtemp(join(tmpdir(),'card-library-'));const app=await createApp({demo,env:{APP_ORIGIN:'https://cards.example.test',OWNER_EMAIL:'owner@example.com',GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret',TOKEN_ENCRYPTION_KEY:'ab'.repeat(32),DATA_DIR:dir,...extraEnv},fetch:fetchMock});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+app.server.address().port;
  t.after(async()=>{await new Promise(r=>app.server.close(r));app.store.close();await rm(dir,{recursive:true,force:true});});
  const addSession=(email,role='staff')=>{app.store.db.prepare('INSERT INTO members VALUES(?,?,1) ON CONFLICT(email) DO UPDATE SET active=1').run(email,role);const id=email.split('@')[0];app.store.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(id,email,'csrf-'+id,Date.now()+60000);return {Cookie:'__Host-card-session='+id,'x-csrf-token':'csrf-'+id};};
  const call=async(path,{method='GET',headers={},body}={})=>{const r=await fetch(origin+path,{method,redirect:'manual',headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,headers:r.headers,data:await r.text().then(v=>{try{return JSON.parse(v);}catch{return v;}})};};return {...app,origin,call,addSession};
}
test('API denies anonymous, staff administration, CSRF and revoked sessions',async t=>{
  const a=await fixture(t);assert.equal((await a.call('/api/cards')).status,401);const staff=a.addSession('staff@example.com');
  assert.equal((await a.call('/api/cards',{method:'POST',headers:staff,body:{name:'員工新增'}})).status,201);
  assert.equal((await a.call('/api/backup',{headers:staff})).status,403);assert.equal((await a.call('/api/members',{headers:staff})).status,403);
  assert.equal((await a.call('/api/cards',{method:'POST',headers:{Cookie:staff.Cookie},body:{name:'無 CSRF'}})).status,403);
  assert.equal((await a.call('/api/cards',{method:'POST',headers:{...staff,Origin:'https://evil.test'},body:{name:'跨站'}})).status,403);
  a.store.db.prepare('UPDATE members SET active=0 WHERE email=?').run('staff@example.com');assert.equal((await a.call('/api/cards',{headers:staff})).status,401);
});
test('API photo preservation, OCR failure visibility, full backup and restore',async t=>{
  const a=await fixture(t);const owner=a.addSession('owner@example.com','owner');
  const p=await a.call('/api/photos',{method:'POST',headers:owner,body:{dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6nL8AAAAASUVORK5CYII='}});assert.equal(p.status,201);
  const c=await a.call('/api/cards',{method:'POST',headers:owner,body:{name:'待補資料',photoIds:[p.data.id]}});assert.equal(c.status,201);
  const ocr=await a.call('/api/ocr',{method:'POST',headers:owner,body:{photoIds:[p.data.id]}});assert.equal(ocr.status,503);assert.match(ocr.data.error,/照片已保留/);
  const backup=await a.call('/api/backup',{headers:owner});assert.equal(backup.data.photos.length,1);assert.equal(backup.data.cards[0].photoIds[0],p.data.id);
  const staff=a.addSession('staff@example.com');assert.equal((await a.call('/api/cards/'+c.data.id,{method:'DELETE',headers:staff,body:{revision:1}})).status,403);
  assert.equal((await a.call('/api/cards/'+c.data.id,{method:'DELETE',headers:owner,body:{revision:1}})).status,200);
  assert.equal((await a.call('/api/cards',{headers:owner})).data.length,0);
  assert.equal((await a.call('/api/cards/'+c.data.id+'/restore',{method:'POST',headers:owner,body:{revision:2}})).status,200);
  assert.equal((await a.call('/api/photos/'+p.data.id,{headers:owner})).status,200);
});
test('OAuth rejects invalid state and an unapproved Google account',async t=>{
  const googleMock=async url=>({ok:true,json:async()=>String(url).includes('/token')?{access_token:'fake'}:{sub:'google-user',email:'intruder@example.com',email_verified:true}});
  const a=await fixture(t,{fetch:googleMock});assert.equal((await a.call('/auth/callback?code=x&state=wrong')).status,403);
  const start=await a.call('/auth/google');assert.equal(start.status,302);const target=new URL(start.headers.get('location'));assert.equal(target.searchParams.get('code_challenge_method'),'S256');
  const state=target.searchParams.get('state');const cb=await a.call('/auth/callback?code=x&state='+state,{headers:{Cookie:'card-oauth='+state}});assert.equal(cb.status,403);assert.match(cb.data.error,/尚未由管理員核准/);
  assert.equal((await a.call('/auth/callback?code=x&state='+state,{headers:{Cookie:'card-oauth='+state}})).status,403);
});
test('production refuses to start with incomplete security configuration',async()=>{
  await assert.rejects(createApp({demo:false,env:{}}),/正式模式需要/);
});
test('owner Drive consent encrypts refresh token and photo sync is retry-safe',async t=>{
  let uploads=0;
  const mock=async(url,init={})=>({ok:true,json:async()=>{
    url=String(url);
    if(url.includes('/token'))return {access_token:'access',refresh_token:'refresh-private-token',scope:'openid email https://www.googleapis.com/auth/drive.file'};
    if(url.includes('/userinfo'))return {sub:'google-owner',email:'owner@example.com',email_verified:true};
    if(url.includes('/upload/')){uploads++;return {id:'drive-photo'};}
    if(url.includes('/drive/v3/files')&&init.method==='POST')return {id:'drive-folder'};
    if(url.includes('/drive/v3/files'))return {files:[]};
    throw new Error('Unexpected URL');
  }});
  const a=await fixture(t,{fetch:mock});const owner=a.addSession('owner@example.com','owner');
  const start=await a.call('/auth/google?purpose=drive',{headers:owner});assert.equal(start.status,302);const state=new URL(start.headers.get('location')).searchParams.get('state');
  const cb=await a.call('/auth/callback?state='+state+'&code=test',{headers:{Cookie:owner.Cookie+'; card-oauth='+state}});assert.equal(cb.status,302);
  assert.ok(a.store.setting('drive.refresh'));assert.ok(!a.store.setting('drive.refresh').includes('refresh-private-token'));
  a.store.db.prepare('INSERT INTO photos(id,card_id,mime,bytes,created_at) VALUES(?,?,?,?,?)').run('p1','c1','image/png',Buffer.from([137,80,78,71,13,10,26,10]),new Date().toISOString());
  const first=await a.call('/api/drive/sync',{method:'POST',headers:owner,body:{}});assert.equal(first.status,200);assert.equal(first.data.count,1);
  const second=await a.call('/api/drive/sync',{method:'POST',headers:owner,body:{}});assert.equal(second.data.count,0);assert.equal(uploads,1);
});
test('OCR uses both images, returns uncertainty and leaves the saved card untouched',async t=>{
  let request;
  const mock=async(url,init)=>{request=JSON.parse(init.body);return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({name:'王小明',company:'測試公司',mobile:'0912345678',rawText:'照片原文',uncertainFields:['mobile','nonexistent']})}]}}]})};};
  const a=await fixture(t,{fetch:mock,extraEnv:{GEMINI_API_KEY:'fake-only',GEMINI_MODEL:'test-model'}});const owner=a.addSession('owner@example.com','owner');
  for(const id of ['front','back'])a.store.db.prepare('INSERT INTO photos(id,mime,bytes,created_at) VALUES(?,?,?,?)').run(id,'image/png',Buffer.from([137,80,78,71,13,10,26,10]),new Date().toISOString());
  const c=a.store.save({name:'原始資料',photoIds:['front','back']},'owner');
  const r=await a.call('/api/ocr',{method:'POST',headers:owner,body:{photoIds:['front','back']}});assert.equal(r.status,200);assert.equal(r.data.name,'王小明');assert.deepEqual(r.data.uncertainFields,['mobile']);assert.equal(request.contents[0].parts.filter(p=>p.inlineData).length,2);assert.equal(a.store.get(c.id).name,'原始資料');
});
test('standalone build preserves dollar identifiers and produces self-contained valid JavaScript',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'card-standalone-'));
  try{
    const path=join(dir,'trial.html');execFileSync(process.execPath,['build-local.mjs',path],{cwd:new URL('..',import.meta.url)});
    const html=await readFile(path,'utf8');assert.ok(!html.includes('src="./app.js"'));assert.ok(!html.includes('href="./style.css"'));const script=html.match(/<script type="module">([\s\S]*)<\/script>/)[1];
    assert.ok(script.includes('const $=s=>document.querySelector(s), $$='));assert.ok(!script.includes("import('./demo.js')"));assert.doesNotThrow(()=>new Script('(async()=>{'+script+'\n})()'));
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('health endpoint is public without exposing identity or credentials',async t=>{
  const a=await fixture(t);const health=await a.call('/health');assert.equal(health.status,200);assert.deepEqual(health.data,{ok:true,service:'shared-card-library',mode:'shared'});assert.equal((await a.call('/api/cards')).status,401);
});
test('Railway production refuses an ephemeral filesystem',async()=>{
  await assert.rejects(createApp({demo:false,env:{APP_ORIGIN:'https://cards.example.test',OWNER_EMAIL:'owner@example.com',GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret',TOKEN_ENCRYPTION_KEY:'ab'.repeat(32),RAILWAY_ENVIRONMENT_ID:'production'}}),/持久磁碟/);
});
test('staff save queues Drive upload; failures preserve data and can be retried by owner',async t=>{
  let failing=true,uploadAttempts=0;
  const mock=async(url,init={})=>{
    url=String(url);
    if(url.includes('/upload/')){uploadAttempts++;return {ok:!failing,status:failing?503:200,json:async()=>({id:'drive-photo'})};}
    return {ok:true,json:async()=>{
      if(url.includes('/token'))return {access_token:'access',refresh_token:'refresh-private-token',scope:'openid email https://www.googleapis.com/auth/drive.file'};
      if(url.includes('/userinfo'))return {sub:'google-owner',email:'owner@example.com',email_verified:true};
      if(url.includes('/drive/v3/files')&&init.method==='POST')return {id:'drive-folder'};
      if(url.includes('/drive/v3/files'))return {files:[]};
      throw new Error('Unexpected URL');
    }};
  };
  const a=await fixture(t,{fetch:mock});const owner=a.addSession('owner@example.com','owner'),staff=a.addSession('staff@example.com');
  const start=await a.call('/auth/google?purpose=drive',{headers:owner});const state=new URL(start.headers.get('location')).searchParams.get('state');
  assert.equal((await a.call('/auth/callback?state='+state+'&code=test',{headers:{Cookie:owner.Cookie+'; card-oauth='+state}})).status,302);
  await a.call('/api/drive/sync',{method:'POST',headers:owner,body:{}});
  const photo=await a.call('/api/photos',{method:'POST',headers:staff,body:{dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6nL8AAAAASUVORK5CYII='}});
  const saved=await a.call('/api/cards',{method:'POST',headers:staff,body:{name:'同步失敗仍保留',photoIds:[photo.data.id]}});assert.equal(saved.status,201);
  let status;
  for(let i=0;i<40;i++){status=(await a.call('/api/bootstrap',{headers:owner})).data;if(status.driveError)break;await new Promise(r=>setTimeout(r,5));}
  assert.match(status.driveError,/503/);assert.equal(status.pendingPhotos,1);assert.equal(a.store.get(saved.data.id).name,'同步失敗仍保留');
  failing=false;const retry=await a.call('/api/drive/sync',{method:'POST',headers:owner,body:{}});assert.equal(retry.data.count,1);
  const latest=(await a.call('/api/bootstrap',{headers:owner})).data;assert.equal(latest.driveError,'');assert.equal(latest.pendingPhotos,0);assert.ok(latest.driveLastSync);assert.equal(uploadAttempts,2);
});
