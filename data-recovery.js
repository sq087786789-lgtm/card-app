'use strict';
const status=document.querySelector('#status'),button=document.querySelector('#export');
function oldCards(){return new Promise((resolve,reject)=>{
  const request=indexedDB.open('card-app');let absent=false;
  request.onupgradeneeded=()=>{absent=true;request.transaction.abort();};
  request.onerror=()=>absent?resolve([]):reject(new Error('無法讀取本機資料，請改用原本的瀏覽器。'));
  request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('cards')){db.close();resolve([]);return;}const tx=db.transaction('cards','readonly'),r=tx.objectStore('cards').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('讀取舊名片失敗，原資料沒有變更。'));tx.oncomplete=()=>db.close();};
});}
function dataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('照片讀取失敗。'));reader.readAsDataURL(blob);});}
async function localPhoto(image){
  if(!image)return '';
  if(image instanceof Blob)return /^image\/(jpeg|png|webp)$/.test(image.type)?dataUrl(image):'';
  if(typeof image!=='string')return '';
  if(/^data:image\/(jpeg|png|webp);base64,/.test(image))return image;
  const url=new URL(image,location.href),base=new URL('./images/',location.href);
  if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return '';
  // Read only this app's former image cache. Never fetch arbitrary stored URLs.
  if('caches' in window){for(const key of await caches.keys()){if(!key.startsWith('card-app-'))continue;const hit=await (await caches.open(key)).match(url.href);if(hit?.ok){const blob=await hit.blob();if(/^image\/(jpeg|png|webp)$/.test(blob.type))return dataUrl(blob);}}}
  return '';
}
button.onclick=async()=>{
  button.disabled=true;status.textContent='正在讀取原裝置的名片…';
  try{const cards=await oldCards();if(!cards.length){status.textContent='這個瀏覽器沒有找到舊名片。請在原本存名片的裝置開啟此頁；新版 Google 名片庫的資料不在這裡。';return;}
    let missing=0;const output=[];
    for(const source of cards){const card={...source};try{card.image=await localPhoto(source.image);}catch{card.image='';}if(source.image&&!card.image){missing++;card.note=(card.note||'')+'\n舊照片不在本機備份內，請重新加入原始名片照片。';card.reviewed=false;}output.push(card);}
    const body={format:'legacy-card-app-export',version:1,exportedAt:new Date().toISOString(),cards:output};const url=URL.createObjectURL(new Blob([JSON.stringify(body,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='舊名片備份-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    status.textContent='已產生 '+cards.length+' 張名片的備份。'+(missing?'其中 '+missing+' 張缺少照片，已在備註標示。':'')+'\n原本機資料未刪除；請到新版匯入。';
  }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
};
