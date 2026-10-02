/**
 * Installed-app worker. It only replaces the previous worker.
 *
 * It does not intercept pictures, scripts, or page loads. Doing that made every
 * tap wait on the worker before the network, which is why the home-screen app
 * felt slower than the site in the browser.
 */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});
