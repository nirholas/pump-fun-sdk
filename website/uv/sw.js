/*
 * Ultraviolet Service Worker Wrapper for LairOS
 * This file imports the config and the main UV service worker
 * Compatible with bare-mux v2
 */

// Import the UV bundle (contains codec and other utilities)
importScripts('/uv/uv.bundle.js');

// Define config inline for service worker context
self.__uv$config = {
  // Bare server
  bare: [
    "https://openbare.xyz/bare/",
  ],
  prefix: "/uv/service/",
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: "/uv/uv.handler.js",
  client: "/uv/uv.client.js",
  bundle: "/uv/uv.bundle.js",
  config: "/uv/uv.config.js",
  sw: "/uv/uv.sw.js",
};

// Import the main UV service worker class
importScripts('/uv/uv.sw.js');

// Create UV service worker instance
const uv = new UVServiceWorker();

// Take control immediately on install
self.addEventListener('install', (event) => {
  console.log('UV SW: Installing...');
  self.skipWaiting();
});

// Claim all clients immediately on activation
self.addEventListener('activate', (event) => {
  console.log('UV SW: Activating...');
  event.waitUntil(self.clients.claim());
});

// Handle fetch events - intercept requests to proxied URLs
self.addEventListener('fetch', (event) => {
  // Check if this request should be handled by UV
  if (uv.route(event)) {
    event.respondWith(uv.fetch(event));
  }
  // Otherwise, let it pass through (don't call respondWith)
});
