// Minimal service worker so phones offer "Install app".
// It always loads fresh files from the network, so updates show up right away.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
