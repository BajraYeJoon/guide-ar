"use client";

// Cached, lazily-loaded AR detection engine.
//
// Why this exists:
//  - The TensorFlow runtime and the coco-ssd model are heavy. Loading them
//    inside a React component means they get thrown away on every unmount
//    (e.g. when navigating to a detail page) and re-downloaded on return.
//  - The model weights (~few MB) were being fetched from storage.googleapis.com
//    on every single visit, so the AR view took seconds to become usable and
//    did not work offline at all.
//
// This module solves both by:
//  1. Holding the backend + model as a module-level singleton that survives
//     component remounts (loads at most once per page lifetime).
//  2. Persisting the model into IndexedDB after the first network fetch, then
//     loading from IndexedDB on every subsequent visit — instant and offline.
//  3. Dynamically importing tfjs / coco-ssd so their bundles are only fetched
//     on the AR route, keeping the home and admin pages lean.

import type * as tfType from "@tensorflow/tfjs";
import type * as cocoSsdType from "@tensorflow-models/coco-ssd";

// IndexedDB key tfjs uses to store the serialized graph model.
const MODEL_IDB_URL = "indexeddb://guide-ar-coco-ssd-lite";
const MODEL_BASE = "lite_mobilenet_v2" as const;

type CocoModel = cocoSsdType.ObjectDetection;

// The single in-flight (or resolved) load promise. Every caller awaits the
// same promise, so concurrent callers never trigger a second load.
let modelPromise: Promise<CocoModel> | null = null;
let cachedModel: CocoModel | null = null;

async function loadTf(): Promise<typeof tfType> {
  const tf = await import("@tensorflow/tfjs");
  await import("@tensorflow/tfjs-backend-webgl");
  // Prefer WebGL; fall back silently to whatever backend is available.
  try {
    await tf.setBackend("webgl");
  } catch {
    // keep default backend
  }
  await tf.ready();
  return tf;
}

// Load coco-ssd, preferring the IndexedDB copy. On a cache miss we download
// from the network and persist for next time.
async function loadModel(): Promise<CocoModel> {
  const [tf, cocoSsd] = await Promise.all([
    loadTf(),
    import("@tensorflow-models/coco-ssd"),
  ]);

  // 1) Try the offline IndexedDB copy first.
  try {
    const models = await tf.io.listModels();
    if (models[MODEL_IDB_URL]) {
      return await cocoSsd.load({ base: MODEL_BASE, modelUrl: MODEL_IDB_URL });
    }
  } catch {
    // listModels can throw in private-mode / no-IDB environments — fall through.
  }

  // 2) Cache miss: download from the default CDN, then persist to IndexedDB so
  //    future loads are instant and work offline.
  const model = await cocoSsd.load({ base: MODEL_BASE });
  try {
    // coco-ssd keeps the underlying GraphModel on `.model`; save it directly.
    const graph = (model as unknown as { model?: tfType.GraphModel }).model;
    if (graph && typeof graph.save === "function") {
      await graph.save(MODEL_IDB_URL);
    }
  } catch {
    // Persisting is a nice-to-have; detection still works without it.
  }
  return model;
}

/**
 * Get the shared coco-ssd model, loading it (once) if necessary. Safe to call
 * from multiple components — they all share one load and one instance.
 */
export function getModel(): Promise<CocoModel> {
  if (cachedModel) return Promise.resolve(cachedModel);
  if (!modelPromise) {
    modelPromise = loadModel()
      .then((model) => {
        cachedModel = model;
        return model;
      })
      .catch((err) => {
        // Reset so a later retry can attempt a fresh load.
        modelPromise = null;
        throw err;
      });
  }
  return modelPromise;
}

/** True once the model is resident in memory (used for progressive UI). */
export function isModelReady(): boolean {
  return cachedModel !== null;
}

/**
 * Kick off loading without awaiting — call this as early as possible (e.g. on
 * the home screen) so the model is warm by the time the user opens AR.
 */
export function warmUpModel(): void {
  void getModel().catch(() => {
    // Warm-up failures are non-fatal; the AR view will retry on mount.
  });
}
