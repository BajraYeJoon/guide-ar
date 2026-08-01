import type { TargetInfo } from "@/lib/types";

// Stabilization thresholds (consecutive frames)
export const LOCK_THRESHOLD = 3;
export const UNLOCK_THRESHOLD = 5;

// Camera constraints
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: "environment",
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
  audio: false,
};

// Find the target whose configured COCO-SSD detection classes contain the
// detected class name. Targets are dynamic (Convex / IndexedDB), so the
// mapping lives on each target document.
export function findTargetByClass(
  className: string,
  targets: TargetInfo[]
): TargetInfo | null {
  return (
    targets.find((target) => target.detectionClasses.includes(className)) ??
    null
  );
}
