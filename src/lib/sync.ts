// One-time-connect sync: pulls every target (with its image) from Convex and
// caches everything in IndexedDB so the app works fully offline afterwards.

import { api } from "../../convex/_generated/api";
import type { ArBundle, TargetInfo } from "@/lib/types";
import { getConvex } from "@/lib/convex";
import { getMeta, putImage, putTargets, setMeta } from "@/lib/db";
import { extractImageUrls } from "@/lib/html-images";

const LAST_SYNC_KEY = "lastSyncedAt";
const BUNDLE_META_KEY = "arBundle";

// Fetch a remote image URL and store its blob for offline use. data:/blob:
// URLs are self-contained (or session-scoped) and skipped.
async function cacheImage(url: string): Promise<void> {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return;
  try {
    const response = await fetch(url);
    if (response.ok) await putImage(url, await response.blob());
  } catch {
    // Skip images that fail; the target itself is still cached.
  }
}

export async function syncTargets(): Promise<TargetInfo[]> {
  const convex = getConvex();

  const remote = await convex.query(api.targets.list, {});

  // Cache the hero image plus every image embedded in the rich content so the
  // whole detail page renders offline.
  await Promise.all(
    remote.flatMap((target) => {
      const urls = new Set<string>();
      if (target.imageUrl) urls.add(target.imageUrl);
      if (target.content)
        for (const u of extractImageUrls(target.content)) urls.add(u);
      return [...urls].map(cacheImage);
    })
  );

  await putTargets(remote);
  await setMeta(LAST_SYNC_KEY, Date.now());

  // Cache the compiled MindAR tracking bundle (the .mind binary) so live AR
  // works offline. Non-fatal: a missing/unbuilt bundle just leaves AR unbuilt.
  try {
    const bundle = (await convex.query(
      api.targets.getArBundle,
      {}
    )) as ArBundle | null;
    if (bundle?.mindUrl) {
      await cacheImage(bundle.mindUrl);
      await setMeta(BUNDLE_META_KEY, bundle);
    }
  } catch {
    // Ignore — the bundle refreshes again next sync / when AR opens.
  }

  return remote;
}

export function getLastSyncedAt(): Promise<number | null> {
  return getMeta<number>(LAST_SYNC_KEY);
}
