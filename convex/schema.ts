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

    // COCO-SSD class names that should resolve to this target during live AR
    // detection (e.g. ["mouse"] or ["bottle", "cup"]). This is what makes an
    // admin-created target actually detectable by the camera.
    detectionClasses: v.array(v.string()),

    // Image is stored in Convex file storage. `imageStorageId` is the source of
    // truth; `referenceImage` is an optional fallback path for data migrated
    // from the old static /public/targets/* files.
    imageStorageId: v.optional(v.id("_storage")),
    referenceImage: v.optional(v.string()),

    // Monotonic marker used by the offline client to detect changes.
    updatedAt: v.number(),
  })
    // Look up a target by a detection class name during AR scanning.
    .index("by_updatedAt", ["updatedAt"]),
});
