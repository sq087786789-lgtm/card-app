let personalToken='';
try{personalToken=sessionStorage.getItem('card-personal-session-v1')||'';}catch{}
function setPersonalToken(token){personalToken=token;try{if(token)sessionStorage.setItem('card-personal-session-v1',token);else sessionStorage.removeItem('card-personal-session-v1');}catch{}}
function loginRpc(name,...args){if(personalRemote)return remoteRpc(name==='beginPersonalLogin'?'beginLogin':'pollLogin',{flow:args[0],secret:args[1]});return new Promise((resolve,reject)=>google.script.run.withSuccessHandler(r=>r?.ok?resolve(r.data):reject(Object.assign(Error(r?.error||'登入失敗，請重試。'),r))).withFailureHandler(()=>reject(Error('Google 連線失敗，請重試。')))[name](...args));}
let loginGeneration=0;
async function preparePersonalLogin(){
  const generation=++loginGeneration,link=$('#personalLogin'),message=$('#loginMessage');link.hidden=true;message.textContent='正在準備安全登入…';
  try{
    const flow=await loginRpc('beginPersonalLogin');if(generation!==loginGeneration)return;
    const url=new URL(flow.url);if(url.origin!=='https://accounts.google.com')throw Error('登入連結無效。');
    link.href=url.href;link.hidden=false;message.textContent='選擇 sq087786789@gmail.com；登入完成後回到本分頁。';
    const deadline=Date.now()+300000;
    link.onclick=()=>{link.onclick=null;message.textContent='等待 Google 登入，完成後請回到這裡。';poll();};
    async function poll(){
      if(generation!==loginGeneration)return;
      if(Date.now()>=deadline){message.textContent='登入逾時，請按重新準備登入。';link.hidden=true;return;}
      try{const result=await loginRpc('pollPersonalLogin',flow.flow,flow.secret);if(generation!==loginGeneration)return;
        if(result.token){++loginGeneration;setPersonalToken(result.token);await startPersonal();return;}
        setTimeout(poll,2000);
      }catch(e){message.textContent=e.message;link.hidden=true;}
    }
  }catch(e){message.textContent=e.message;}
}
async function startPersonal(){
  try{
    boot=await api('/api/bootstrap');$('#userLabel').textContent=boot.user.email;$('#logout').hidden=true;$('#storageLabel').textContent='私人 Google Drive';$('#summaryStorage').textContent='私人 Google Drive';$('#modeBanner').textContent='只有本人可使用';$('#personalStatus').textContent='已連接你的私人名片庫';
    document.body.dataset.auth='ready';$('#loginGate').hidden=true;$('#personalCamera').disabled=false;$('#addCard').disabled=false;await reload();
  }catch(e){
    if(e.status===401||e.status===403)setPersonalToken('');
    document.body.dataset.auth='pending';$('#loginGate').hidden=false;
    if(e.status===401||e.status===403)await preparePersonalLogin();else $('#loginMessage').textContent=e.message;
  }
}
