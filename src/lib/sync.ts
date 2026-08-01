// One-time-connect sync: pulls every target (with its image) from Convex and
// caches everything in IndexedDB so the app works fully offline afterwards.

import { api } from "../../convex/_generated/api";
import type { TargetInfo } from "@/lib/types";
import { getConvex } from "@/lib/convex";
import { getMeta, putImage, putTargets, setMeta } from "@/lib/db";

const LAST_SYNC_KEY = "lastSyncedAt";

export async function syncTargets(): Promise<TargetInfo[]> {
  const convex = getConvex();

  const remote = await convex.query(api.targets.list, {});

  // Cache every image as a blob so it renders offline.
  await Promise.all(
    remote.map(async (target) => {
      if (target.imageUrl) {
        try {
          const response = await fetch(target.imageUrl);
          if (response.ok) {
            await putImage(target.imageUrl, await response.blob());
          }
        } catch {
          // Skip images that fail; the target itself is still cached.
        }
      }
    })
  );

  await putTargets(remote);
  await setMeta(LAST_SYNC_KEY, Date.now());

  return remote;
}

export function getLastSyncedAt(): Promise<number | null> {
  return getMeta<number>(LAST_SYNC_KEY);
}
