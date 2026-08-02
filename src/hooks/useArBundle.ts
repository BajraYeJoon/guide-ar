"use client";

import { useEffect, useRef, useState } from "react";
import type { ArBundle } from "@/lib/types";
import { api } from "../../convex/_generated/api";
import { getConvex } from "@/lib/convex";
import { getImage, getMeta, putImage, setMeta } from "@/lib/db";

// IndexedDB meta key holding the last-known bundle (as returned by Convex, i.e.
// with the *remote* mindUrl — which doubles as the blob cache key).
const BUNDLE_META_KEY = "arBundle";

interface UseArBundleReturn {
  bundle: ArBundle | null;
  loading: boolean;
}

/**
 * Offline-first loader for the compiled MindAR tracking bundle. Serves the
 * cached bundle immediately (resolving the `.mind` blob to a local blob: URL),
 * then refreshes from Convex when online and re-caches. Mirrors the offline
 * strategy in useTargets — cache first, network second.
 */
export function useArBundle(): UseArBundleReturn {
  const [bundle, setBundle] = useState<ArBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const revoke = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };

    // Turn a Convex-shaped bundle (remote mindUrl) into one whose mindUrl points
    // at a cached offline blob when we have it.
    const toOffline = async (remote: ArBundle): Promise<ArBundle> => {
      if (!remote.mindUrl) return remote;
      const blob = await getImage(remote.mindUrl);
      if (!blob) return remote; // not cached yet — use remote URL directly
      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;
      return { ...remote, mindUrl: objectUrl };
    };

    (async () => {
      // 1) Serve whatever is cached first.
      const cached = await getMeta<ArBundle>(BUNDLE_META_KEY);
      if (!cancelled && cached) {
        const resolved = await toOffline(cached);
        if (!cancelled) setBundle(resolved);
      }

      // 2) Refresh from Convex when online.
      if (navigator.onLine) {
        try {
          const remote = (await getConvex().query(
            api.targets.getArBundle,
            {}
          )) as ArBundle | null;
          if (remote?.mindUrl) {
            // Cache the compiled .mind binary (keyed by its remote URL).
            try {
              const res = await fetch(remote.mindUrl);
              if (res.ok) await putImage(remote.mindUrl, await res.blob());
            } catch {
              // keep going; remote URL still works while online
            }
            await setMeta(BUNDLE_META_KEY, remote);
            if (!cancelled) {
              revoke();
              const resolved = await toOffline(remote);
              if (!cancelled) setBundle(resolved);
            }
          }
        } catch {
          // Offline / unreachable — keep the cached bundle.
        }
      }

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
      revoke();
    };
  }, []);

  return { bundle, loading };
}
