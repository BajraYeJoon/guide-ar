/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, NetworkOnly, Serwist } from "serwist";

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // The admin section is network-only: never served from cache, so content
    // management always reflects the live database.
    {
      matcher: ({ url }: { url: URL }) => url.pathname.startsWith("/admin"),
      handler: new NetworkOnly(),
    },
    // MindAR's runtime loads a TensorFlow model from the tfjs-models CDN on
    // first use. Cache it aggressively so Live AR works offline after one run.
    {
      matcher: ({ url }: { url: URL }) =>
        url.hostname === "storage.googleapis.com" &&
        url.pathname.includes("tfjs-models"),
      handler: new CacheFirst({ cacheName: "mindar-tfjs-model" }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
