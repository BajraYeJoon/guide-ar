import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// A single spec row shown in the UI (e.g. { label: "Sensor", value: "16,000 DPI" }).
const specValidator = v.object({
  label: v.string(),
  value: v.string(),
});

export default defineSchema({
  targets: defineTable({
    // Human-readable identity
    name: v.string(),
    // Short summary shown on cards and the AR lock sheet.
    description: v.string(),
    // Rich HTML body authored in the admin editor (blog-style, may embed
    // <img> tags). This is the primary content shown on the detail page.
    content: v.optional(v.string()),
    // Legacy fields kept optional so pre-existing documents still validate.
    // New targets author everything through `content` instead.
    history: v.optional(v.string()),
    specs: v.optional(v.array(specValidator)),

    // DEPRECATED: COCO-SSD class names. The app now uses MindAR image tracking
    // (the reference image itself is the tracking target), so this is no longer
    // written or read. Kept optional purely so pre-existing documents validate.
    detectionClasses: v.optional(v.array(v.string())),

    // The reference image is stored in Convex file storage and doubles as the
    // MindAR tracking target. `imageStorageId` is the source of truth;
    // `referenceImage` is an optional fallback path for data migrated from the
    // old static /public/targets/* files.
    imageStorageId: v.optional(v.id("_storage")),
    referenceImage: v.optional(v.string()),

    // Monotonic marker used by the offline client to detect changes.
    updatedAt: v.number(),
  }).index("by_updatedAt", ["updatedAt"]),

  // Singleton row holding the compiled MindAR tracking bundle. The admin's
  // "Build AR tracking" action compiles every target's reference image into one
  // `.mind` file (stored in file storage) and records the exact compile order
  // in `targetIds` — index `i` in the bundle maps to `targetIds[i]`.
  arBundle: defineTable({
    mindStorageId: v.id("_storage"),
    targetIds: v.array(v.string()),
    updatedAt: v.number(),
  }),
});
