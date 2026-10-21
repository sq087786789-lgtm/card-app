// Retire the former offline app. Leave its local database and image caches intact.
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
  await self.clients.claim();
  const entry=new URL('./',self.registration.scope);
  for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){
    const url=new URL(client.url);
    if(url.origin===entry.origin&&(url.pathname===entry.pathname||url.pathname===entry.pathname+'index.html'))await client.navigate(entry.href);
  }
})());});
// No cache-first fetch handler: future navigation always loads the current entry.
