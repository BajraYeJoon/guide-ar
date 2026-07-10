import { TargetInfo } from "@/data/targets";

// Map COCO-SSD class names to our target IDs
export const CLASS_TO_TARGET: Record<string, string> = {
  mouse: "mouse",
  bottle: "bottle",
  cup: "bottle",
};

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

// Find target by COCO-SSD class name
export function findTargetByClass(
  className: string,
  targets: TargetInfo[]
): TargetInfo | null {
  const targetId = CLASS_TO_TARGET[className];
  if (!targetId) return null;
  return targets.find((t) => t.id === targetId) ?? null;
}
