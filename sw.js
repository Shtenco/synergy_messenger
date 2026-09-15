const CACHE = 'synergy-messenger-v3-p6';
const ASSETS = [
  './','./index.html','./css/design-system.css','./css/app.css','./js/ui-extras.js','./js/v3-bootstrap.js','./js/app.js','./manifest.json','./icons/icon-192.png','./icons/icon-512.png'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request).then(async cached=>{
    if(cached)return cached;
    try{const response=await fetch(e.request);if(response.ok&&new URL(e.request.url).origin===self.location.origin){const cache=await caches.open(CACHE);cache.put(e.request,response.clone());}return response;}
    catch{return caches.match('./index.html');}
  }));
});
