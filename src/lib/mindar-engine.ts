"use client";

// Lazy loaders for the (heavy) MindAR modules. The three.js runtime and the
// image compiler each bundle their own TensorFlow build, so they are imported
// dynamically on the client only. The resolved module promise is cached at the
// module level so re-opening Live AR (or re-running a compile) is instant —
// this replaces the old COCO-SSD singleton in ar-engine.ts.
//
// MindAR ships no TypeScript types, so we declare the minimal structural shapes
// we actually use.

export interface MindARAnchor {
  onTargetFound?: () => void;
  onTargetLost?: () => void;
  group: unknown;
}

export interface MindARThreeInstance {
  renderer: {
    setAnimationLoop: (cb: (() => void) | null) => void;
    render: (scene: unknown, camera: unknown) => void;
    domElement: HTMLCanvasElement;
  };
  scene: unknown;
  camera: unknown;
  addAnchor: (targetIndex: number) => MindARAnchor;
  start: () => Promise<void>;
  stop: () => void;
}

export interface MindARThreeOptions {
  container: HTMLElement;
  imageTargetSrc: string;
  // "yes" | "no" | a CSS selector. "no" disables MindAR's built-in overlays so
  // we can render our own status UI.
  uiScanning?: string;
  uiLoading?: string;
  uiError?: string;
  maxTrack?: number;
  filterMinCF?: number;
  filterBeta?: number;
  missTolerance?: number;
  warmupTolerance?: number;
}

type MindARThreeCtor = new (opts: MindARThreeOptions) => MindARThreeInstance;

interface MindARImageThreeModule {
  MindARThree: MindARThreeCtor;
}

export interface MindARCompiler {
  compileImageTargets: (
    images: HTMLImageElement[],
    onProgress: (percent: number) => void
  ) => Promise<unknown>;
  // Serialized .mind data for all compiled targets.
  exportData: () => Promise<ArrayBuffer | Uint8Array>;
}

interface MindARImageModule {
  Compiler: new () => MindARCompiler;
}

let threeModulePromise: Promise<MindARImageThreeModule> | null = null;
let compilerModulePromise: Promise<MindARImageModule> | null = null;

/** Load (and cache) the MindAR three.js runtime module. */
export function loadMindARThree(): Promise<MindARImageThreeModule> {
  if (!threeModulePromise) {
    threeModulePromise = import(
      "mind-ar/dist/mindar-image-three.prod.js"
    ) as Promise<MindARImageThreeModule>;
    // Reset on failure so a later attempt can retry.
    threeModulePromise.catch(() => {
      threeModulePromise = null;
    });
  }
  return threeModulePromise;
}

/** Load (and cache) the MindAR image-target compiler module (admin only). */
export function loadMindARCompiler(): Promise<MindARImageModule> {
  if (!compilerModulePromise) {
    compilerModulePromise = import(
      "mind-ar/dist/mindar-image.prod.js"
    ) as Promise<MindARImageModule>;
    compilerModulePromise.catch(() => {
      compilerModulePromise = null;
    });
  }
  return compilerModulePromise;
}

/**
 * Fire-and-forget: parse the heavy runtime module ahead of time so opening Live
 * AR is instant. Called from the home page. Replaces `warmUpModel()`.
 */
export function warmUpMindAR(): void {
  loadMindARThree().catch(() => {});
}
