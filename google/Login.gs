// Owner-only OAuth fallback for browsers whose Google multi-login routing fails.
// Credentials stay in Script Properties; no Google tokens reach the browser.
const PERSONAL_CALLBACK_='https://script.google.com/macros/s/AKfycbxW7uPyY5JyhaTZHYGPrg9z_OKdDaNAPYlXqPADlS95al-1PKyuP5YZZ7JS_2XW91qU/exec';
function beginPersonalLogin(){return safe_(()=>locked_(()=>{
  rate_('personal-login',20);const p=props_();
  for(const [k,v] of Object.entries(p.getProperties()))if(/^(personalFlow|personalSession)\./.test(k)){try{if(JSON.parse(v).expires<=Date.now())p.deleteProperty(k);}catch{p.deleteProperty(k);}}
  if(Object.keys(p.getProperties()).filter(k=>k.startsWith('personalFlow.')).length>=30)fail_(429,'登入要求過多，請稍後再試。');
  const client=p.getProperty('GOOGLE_CLIENT_ID');if(!client||!p.getProperty('GOOGLE_CLIENT_SECRET'))fail_(503,'Google 登入尚未設定，請聯絡管理員。');
  const state=id_(),secret=id_(),verifier=id_();
  p.setProperty('personalFlow.'+state,JSON.stringify({secret:hash_(secret),verifier:verifier,expires:Date.now()+300000}));
  const params={client_id:client,redirect_uri:PERSONAL_CALLBACK_,response_type:'code',scope:'openid email',state:state,code_challenge:hash_(verifier),code_challenge_method:'S256',prompt:'select_account',login_hint:OWNER_};
  return {flow:state,secret:secret,url:'https://accounts.google.com/o/oauth2/v2/auth?'+Object.entries(params).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&')};
}));}
function completePersonalLogin_(q){return locked_(()=>{
  const p=props_(),state=String(q.state||'');if(!/^[\w-]{1,100}$/.test(state))fail_(403,'登入狀態不符。');
  const key='personalFlow.'+state,raw=p.getProperty(key);if(!raw)fail_(403,'登入已過期。');
  const f=JSON.parse(raw);if(f.expires<=Date.now()||f.used)fail_(403,'登入連結已過期或使用。');f.used=true;p.setProperty(key,JSON.stringify(f));
  try{
    if(q.error||typeof q.code!=='string'||!q.code||q.code.length>2048)fail_(403,'Google 登入未完成。');
    const t=callGoogle_('https://oauth2.googleapis.com/token',{method:'post',payload:{client_id:p.getProperty('GOOGLE_CLIENT_ID'),client_secret:p.getProperty('GOOGLE_CLIENT_SECRET'),redirect_uri:PERSONAL_CALLBACK_,grant_type:'authorization_code',code:q.code,code_verifier:f.verifier}});
    if(!t.access_token)fail_(403,'Google 登入驗證失敗。');
    const profile=callGoogle_('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+t.access_token}});
    if(!profile.sub||profile.email_verified!==true||String(profile.email||'').toLowerCase()!==OWNER_)fail_(403,'只允許 '+OWNER_+' 使用此私人名片庫。');
    const token=id_();p.setProperty('personalSession.'+hash_(token),JSON.stringify({email:OWNER_,sub:profile.sub,expires:Date.now()+7*86400000}));f.result={token:token};
  }catch(err){f.error=err.status?err.message:'Google 登入暫時失敗，請重新登入。';}
  delete f.verifier;p.setProperty(key,JSON.stringify(f));
});}
function pollPersonalLogin(flow,secret){return safe_(()=>locked_(()=>{
  if(typeof flow!=='string'||typeof secret!=='string'||flow.length>100||secret.length>100)fail_(403,'登入狀態不符。');
  const p=props_(),key='personalFlow.'+flow,raw=p.getProperty(key);if(!raw)fail_(403,'登入已過期，請重試。');
  const f=JSON.parse(raw);if(f.expires<=Date.now()||f.secret!==hash_(secret))fail_(403,'登入狀態不符或已過期。');
  if(f.error){p.deleteProperty(key);fail_(403,f.error);}if(f.result){p.deleteProperty(key);return f.result;}return {pending:true};
}));}
