"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TargetInfo } from "@/lib/types";
import { STATIC_TARGETS } from "@/data/targets";
import { getImage, getTargets } from "@/lib/db";
import { getLastSyncedAt, syncTargets } from "@/lib/sync";

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
// IndexedDB (this is what makes images work offline). Returns the list plus
// the object URLs it created so callers can revoke them.
async function resolveImages(targets: TargetInfo[]): Promise<{
  resolved: TargetInfo[];
  objectUrls: string[];
}> {
  const objectUrls: string[] = [];
  const resolved = await Promise.all(
    targets.map(async (target) => {
      if (!target.imageUrl) return target;
      const blob = await getImage(target.imageUrl);
      if (!blob) return target;
      const objectUrl = URL.createObjectURL(blob);
      objectUrls.push(objectUrl);
      return { ...target, imageUrl: objectUrl };
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
