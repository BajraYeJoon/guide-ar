// MindAR ships no TypeScript types for its prebuilt dist bundles. We declare
// them as untyped modules here; the structural interfaces we actually rely on
// live in src/lib/mindar-engine.ts, which casts these imports to typed shapes.
declare module "mind-ar/dist/mindar-image-three.prod.js";
declare module "mind-ar/dist/mindar-image.prod.js";
