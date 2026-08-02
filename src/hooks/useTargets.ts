"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TargetInfo } from "@/lib/types";
import { STATIC_TARGETS } from "@/data/targets";
import { getImage, getTargets } from "@/lib/db";
import { getLastSyncedAt, syncTargets } from "@/lib/sync";
import { extractImageUrls, rewriteImageUrls } from "@/lib/html-images";

export type SyncStatus = "loading" | "online" | "offline";

interface UseTargetsReturn {
  targets: TargetInfo[];
  /** loading = initial read; online = last sync succeeded; offline = cached only */
  status: SyncStatus;
  syncing: boolean;
  lastSyncedAt: number | null;
  refresh: () => Promise<void>;
}

// Module-level guard so multiple components never sync at the same time.
let syncInFlight: Promise<void> | null = null;

// Swap remote image URLs for local blob object URLs when the blob exists in
// IndexedDB (this is what makes images work offline). Covers both the hero
// image and any images embedded in the rich `content` HTML. Returns the list
// plus the object URLs it created so callers can revoke them.
async function resolveImages(targets: TargetInfo[]): Promise<{
  resolved: TargetInfo[];
  objectUrls: string[];
}> {
  const objectUrls: string[] = [];

  // Resolve a single remote URL to an offline blob URL when cached.
  const toOffline = async (url: string): Promise<string> => {
    if (!url || url.startsWith("data:") || url.startsWith("blob:")) return url;
    const blob = await getImage(url);
    if (!blob) return url;
    const objectUrl = URL.createObjectURL(blob);
    objectUrls.push(objectUrl);
    return objectUrl;
  };

  const resolved = await Promise.all(
    targets.map(async (target) => {
      let next = target;

      if (target.imageUrl) {
        const offline = await toOffline(target.imageUrl);
        if (offline !== target.imageUrl) next = { ...next, imageUrl: offline };
      }

      if (target.content) {
        // Pre-resolve each content image URL, then rewrite synchronously.
        const map = new Map<string, string>();
        await Promise.all(
          extractImageUrls(target.content).map(async (url) => {
            map.set(url, await toOffline(url));
          })
        );
        const content = rewriteImageUrls(
          target.content,
          (url) => map.get(url) ?? url
        );
        if (content !== target.content) next = { ...next, content };
      }

      return next;
    })
  );
  return { resolved, objectUrls };
}

function revokeUrls(urls: string[]) {
  for (const url of urls) URL.revokeObjectURL(url);
}

export function useTargets(): UseTargetsReturn {
  const [targets, setTargets] = useState<TargetInfo[]>([]);
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const objectUrlsRef = useRef<string[]>([]);

  const applyTargets = useCallback(async (list: TargetInfo[]) => {
    const { resolved, objectUrls } = await resolveImages(list);
    revokeUrls(objectUrlsRef.current);
    objectUrlsRef.current = objectUrls;
    setTargets(resolved);
  }, []);

  const runSync = useCallback(async () => {
    if (syncInFlight) return syncInFlight;
    setSyncing(true);
    syncInFlight = (async () => {
      try {
        const fresh = await syncTargets();
        await applyTargets(fresh);
        setStatus("online");
        setLastSyncedAt(await getLastSyncedAt());
      } catch {
        // Offline / unreachable — keep whatever is cached.
        setStatus("offline");
      } finally {
        setSyncing(false);
        syncInFlight = null;
      }
    })();
    return syncInFlight;
  }, [applyTargets]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const cached = await getTargets();
      setLastSyncedAt(await getLastSyncedAt());

      if (!cancelled) {
        if (cached.length > 0) {
          // Offline-first: serve cache immediately, then refresh from Convex.
          await applyTargets(cached);
          if (navigator.onLine) {
            await runSync();
          } else {
            setStatus("offline");
          }
        } else {
          // Never synced before: show static fallback while syncing.
          await applyTargets(STATIC_TARGETS);
          if (navigator.onLine) {
            await runSync();
          } else {
            setStatus("offline");
          }
        }
      }
    };

    boot();

    const handleOnline = () => runSync();
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      revokeUrls(objectUrlsRef.current);
      objectUrlsRef.current = [];
    };
  }, [applyTargets, runSync]);

  const refresh = useCallback(async () => {
    await runSync();
  }, [runSync]);

  return { targets, status, syncing, lastSyncedAt, refresh };
}
