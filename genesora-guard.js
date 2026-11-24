/* Genesora AI - anti-framing guard.
   Static hosting cannot send the X-Frame-Options header, so this does the same job:
   if another website puts this page inside a frame (the "clickjacking" trick), the page
   hides itself and tries to open on its own. Your own pages and normal visits are unaffected. */
(function () {
  'use strict';
  if (window.top === window.self) return;
  try { if (window.top.location.hostname === window.location.hostname) return; } catch (e) { /* different site: treated as framed */ }
  try { document.documentElement.style.display = 'none'; } catch (e) { /* ignore */ }
  try { window.top.location.replace(window.self.location.href); } catch (e) { /* the browser may block this; the page stays hidden */ }
})();
