import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";

// Shape returned to clients: the stored document plus a resolved image URL.
export type TargetWithUrl = Doc<"targets"> & { imageUrl: string | null };

const specValidator = v.object({
  label: v.string(),
  value: v.string(),
});

// Resolve the storage id (if any) to a servable URL, falling back to the
// migrated static path. Kept in one place so every read path is consistent.
async function withImageUrl(
  ctx: { storage: { getUrl: (id: Doc<"targets">["imageStorageId"] & string) => Promise<string | null> } },
  doc: Doc<"targets">
): Promise<TargetWithUrl> {
  let imageUrl: string | null = null;
  if (doc.imageStorageId) {
    imageUrl = await ctx.storage.getUrl(doc.imageStorageId);
  } else if (doc.referenceImage) {
    imageUrl = doc.referenceImage;
  }
  return { ...doc, imageUrl };
}

// List every target with a resolved image URL. This is the endpoint the
// offline client calls once (while online) to hydrate IndexedDB.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("targets").withIndex("by_updatedAt").collect();
    return Promise.all(docs.map((doc) => withImageUrl(ctx, doc)));
  },
});

// Fetch a single target by id (used by the detail view / admin edit form).
export const get = query({
  args: { id: v.id("targets") },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get(id);
    if (!doc) return null;
    return withImageUrl(ctx, doc);
  },
});

// Generate a short-lived URL the admin browser POSTs the raw image bytes to.
// Convex returns a storage id which we then attach to a target via create/update.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    history: v.string(),
    specs: v.array(specValidator),
    detectionClasses: v.array(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    referenceImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("targets", { ...args, updatedAt: Date.now() });
  },
});

export const update = mutation({
  args: {
    id: v.id("targets"),
    name: v.string(),
    description: v.string(),
    history: v.string(),
    specs: v.array(specValidator),
    detectionClasses: v.array(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    referenceImage: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...rest }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Target not found");

    // If the image is being replaced, delete the old stored file to avoid orphans.
    if (
      rest.imageStorageId &&
      existing.imageStorageId &&
      existing.imageStorageId !== rest.imageStorageId
    ) {
      await ctx.storage.delete(existing.imageStorageId);
    }

    await ctx.db.patch(id, { ...rest, updatedAt: Date.now() });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("targets") },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db.get(id);
    if (!existing) return;
    if (existing.imageStorageId) {
      await ctx.storage.delete(existing.imageStorageId);
    }
    await ctx.db.delete(id);
  },
});

// One-time migration helper: imports the two demo targets that used to live in
// /public. No-op once the table already has content. Images keep pointing at
// the static /public/targets/* paths as `referenceImage` until the admin
// uploads real Convex-stored images.
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("targets").first();
    if (existing) return { seeded: false };

    const demos = [
      {
        name: "Wireless Optical Mouse",
        description:
          "A modern wireless computer mouse with ergonomic design, high-precision optical tracking, and long battery life.",
        history:
          "The computer mouse was invented by Douglas Engelbart in 1964 at the Stanford Research Institute. The original was carved from wood with a single button and two perpendicular wheels. Modern wireless mice use laser or optical sensors capable of tracking at 16,000+ DPI on virtually any surface.",
        specs: [
          { label: "Sensor", value: "16,000 DPI Optical" },
          { label: "Battery", value: "70 hrs (Li-ion)" },
          { label: "Latency", value: "1 ms (2.4GHz)" },
          { label: "Weight", value: "63 grams" },
          { label: "Buttons", value: "6 programmable" },
          { label: "Connection", value: "USB-C / BT 5.0" },
        ],
        detectionClasses: ["mouse"],
        referenceImage: "/targets/mouse-reference.jpg",
      },
      {
        name: "Water Bottle",
        description:
          "A standard plastic water bottle with a screw cap, commonly used for hydration.",
        history:
          "Plastic bottles became popular in the 1970s as a lightweight alternative to glass. PET plastic is the most common material for water bottles due to its clarity, strength, and recyclability. Over 1 million plastic bottles are purchased every minute worldwide.",
        specs: [
          { label: "Capacity", value: "500 ml" },
          { label: "Material", value: "PET Plastic" },
          { label: "Height", value: "20 cm" },
          { label: "Weight", value: "15 grams (empty)" },
          { label: "Cap", value: "Screw-on" },
          { label: "Recyclable", value: "Yes" },
        ],
        detectionClasses: ["bottle", "cup"],
        referenceImage: "/targets/bottle.jpg",
      },
    ];

    for (const demo of demos) {
      await ctx.db.insert("targets", { ...demo, updatedAt: Date.now() });
    }
    return { seeded: true };
  },
});
