/* Cairo Quran service worker.
   It only makes the site installable as a home-screen app and shows a short notice when there is no internet.
   Nothing is cached, so every visit always gets the latest version of the site, and audio streams,
   images and other requests never pass through here. */
const OFFLINE = '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Cairo Quran</title><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#050816;color:#fdf6e9;font-family:Tahoma,sans-serif;text-align:center">' +
  '<div><h1 style="color:#e8c27a;font-family:serif;margin:0 0 12px">Cairo Quran</h1><p>لا يوجد اتصال بالإنترنت الآن.<br>تأكد من الاتصال ثم أعد المحاولة.</p>' +
  '<button onclick="location.reload()" style="margin-top:12px;padding:10px 22px;border:0;border-radius:10px;background:#e8c27a;color:#1a1405;font-size:16px">إعادة المحاولة</button></div></body></html>';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(OFFLINE, { headers: { 'content-type': 'text/html; charset=utf-8' } })));
});
