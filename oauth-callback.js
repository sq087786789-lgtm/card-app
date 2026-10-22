// Consume the short-lived Google code, remove it from the address bar immediately,
// and submit only to our own backend. This page never receives an App session token.
(async()=>{
  const q=new URLSearchParams(location.search),status=document.getElementById('callbackStatus');
  history.replaceState(null,'',location.pathname);
  if(!q.get('state')||(!q.get('code')&&!q.get('error'))){status.textContent='沒有待處理的登入，請回到原本的名片分頁重新登入。';return;}
  try{
    const pending=JSON.parse(sessionStorage.getItem('card-personal-pending-v1')||'null');
    if(!pending||pending.flow!==q.get('state')||pending.expires<=Date.now())throw Error('登入狀態不符。');
    const r=await fetch('https://script.google.com/macros/s/AKfycbxW7uPyY5JyhaTZHYGPrg9z_OKdDaNAPYlXqPADlS95al-1PKyuP5YZZ7JS_2XW91qU/exec',{method:'POST',credentials:'omit',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action:'completeLogin',state:q.get('state'),code:q.get('code'),error:q.get('error')})});
    const result=await r.json();if(!r.ok||!result.ok)throw Error('登入未完成，請重試。');
    status.textContent='登入驗證已處理，正在回到名片庫…';location.replace('./library.html');
  }catch{status.textContent='登入連線失敗，請回到原本的名片分頁重新登入。';}
})();
