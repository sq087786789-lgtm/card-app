// Retire the former offline app. Leave its local database and image caches intact.
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
  await self.clients.claim();
  const entry=new URL('./',self.registration.scope);
  // A fresh URL avoids an older HTTP-cached introduction page on existing phones.
  const freshEntry=new URL('?v=direct-20261022',entry);
  for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){
    const url=new URL(client.url);
    // Navigation can wait for activation. Never await it inside activate.waitUntil.
    if(url.origin===entry.origin&&(url.pathname===entry.pathname||url.pathname===entry.pathname+'index.html'))client.navigate(freshEntry.href).catch(()=>{});
  }
})());});
// No cache-first fetch handler: future navigation always loads the current entry.
