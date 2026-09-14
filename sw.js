const CACHE='zen-drive-webgl-v1';
const ASSETS=['/','/index.html','/style.css','/jdm.css','/manifest.webmanifest','/icon.svg','/js/state.js','/js/road.js','/js/vehicle.js','/js/camera.js','/js/webgl-renderer.js','/js/audio.js','/js/controls.js','/js/ui.js','/js/main.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==location.origin)return;e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/index.html'))))});
