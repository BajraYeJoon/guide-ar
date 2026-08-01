// Shared client-side shape for a target. Mirrors the Convex `targets` table
// (convex/schema.ts) with the resolved image URL added at read time.
export interface TargetSpec {
  label: string;
  value: string;
}

export interface TargetInfo {
  /** Convex document id (`_id`) or a stable fallback id for static data. */
  _id: string;
  name: string;
  description: string;
  history: string;
  specs: TargetSpec[];
  /** COCO-SSD class names that resolve to this target during live AR. */
  detectionClasses: string[];
  /** Convex file storage id, when the image is stored in Convex. */
  imageStorageId?: string | null;
  /** Fallback path for legacy static /public/targets/* images. */
  referenceImage?: string | null;
  /** Resolved image URL — remote Convex URL, static path, or an offline blob URL. */
  imageUrl: string | null;
  /** Monotonic marker used to detect changes. */
  updatedAt: number;
}
