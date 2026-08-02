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
  /** Short summary shown on cards and the AR lock sheet. */
  description: string;
  /** Rich HTML body authored in the admin editor (may embed <img> tags). */
  content?: string;
  /** Legacy long-form text; superseded by `content` for new targets. */
  history?: string;
  /** Legacy key/value facts; superseded by `content` for new targets. */
  specs?: TargetSpec[];
  /** DEPRECATED COCO-SSD class names — unused since the switch to MindAR. */
  detectionClasses?: string[];
  /** Convex file storage id, when the image is stored in Convex. */
  imageStorageId?: string | null;
  /** Fallback path for legacy static /public/targets/* images. */
  referenceImage?: string | null;
  /** Resolved image URL — remote Convex URL, static path, or an offline blob URL. */
  imageUrl: string | null;
  /** Monotonic marker used to detect changes. */
  updatedAt: number;
}

/**
 * The compiled MindAR tracking bundle. One `.mind` file contains every target's
 * reference image; `targetIds[i]` is the target whose image was compiled at
 * anchor index `i`. `mindUrl` is the servable (or offline blob) URL to load.
 */
export interface ArBundle {
  mindStorageId: string;
  mindUrl: string | null;
  targetIds: string[];
  updatedAt: number;
}
