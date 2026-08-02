"use client";

import { useEffect, useRef, useState } from "react";
import type { ArBundle, TargetInfo } from "@/lib/types";
import { loadMindARThree, type MindARThreeInstance } from "@/lib/mindar-engine";

export type ARStatus = "loading" | "scanning" | "found";

interface UseMindARTrackingReturn {
  status: ARStatus;
  foundTarget: TargetInfo | null;
  error: boolean;
}

/**
 * Drives MindAR image-target tracking inside `containerRef`. MindAR injects its
 * own camera <video> + <canvas> into the container and emits found/lost events
 * per compiled target; anchor index `i` maps to `bundle.targetIds[i]`.
 *
 * Contract mirrors the old useARDetection hook ({ status, foundTarget, error })
 * so the surrounding AR UI is unchanged. `paused` freezes updates while the
 * detail overlay is open — the tracker keeps running underneath so returning is
 * instant with no re-init flash.
 */
export function useMindARTracking(
  containerRef: React.RefObject<HTMLDivElement | null>,
  paused: boolean,
  targets: TargetInfo[],
  bundle: ArBundle | null
): UseMindARTrackingReturn {
  const [status, setStatus] = useState<ARStatus>("loading");
  const [foundTarget, setFoundTarget] = useState<TargetInfo | null>(null);
  const [error, setError] = useState(false);

  // Keep the latest targets/paused in refs so the MindAR event callbacks (bound
  // once at start) always read current values without re-initializing tracking.
  const targetsRef = useRef(targets);
  const pausedRef = useRef(paused);
  targetsRef.current = targets;
  pausedRef.current = paused;

  const mindarRef = useRef<MindARThreeInstance | null>(null);

  const bundleUrl = bundle?.mindUrl ?? null;
  const targetIds = bundle?.targetIds;

  useEffect(() => {
    // Nothing to track until a compiled bundle exists.
    if (!bundleUrl || !targetIds || targetIds.length === 0) return;

    let cancelled = false;
    let instance: MindARThreeInstance | null = null;

    (async () => {
      try {
        const container = containerRef.current;
        if (!container) return;

        const { MindARThree } = await loadMindARThree();
        if (cancelled) return;

        instance = new MindARThree({
          container,
          imageTargetSrc: bundleUrl,
          uiScanning: "no",
          uiLoading: "no",
          uiError: "no",
        });
        mindarRef.current = instance;

        // Wire each compiled target index to our found/lost state machine.
        targetIds.forEach((id, index) => {
          const anchor = instance!.addAnchor(index);
          anchor.onTargetFound = () => {
            if (pausedRef.current) return;
            const match =
              targetsRef.current.find((t) => t._id === id) ?? null;
            setFoundTarget(match);
            setStatus("found");
          };
          anchor.onTargetLost = () => {
            if (pausedRef.current) return;
            setFoundTarget(null);
            setStatus("scanning");
          };
        });

        await instance.start();
        if (cancelled) {
          instance.stop();
          return;
        }

        // MindAR needs an active render loop to keep tracking.
        const { renderer, scene, camera } = instance;
        renderer.setAnimationLoop(() => {
          renderer.render(scene, camera);
        });

        setStatus("scanning");
      } catch (err) {
        console.error("MindAR tracking failed to start", err);
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
      const inst = mindarRef.current;
      if (inst) {
        try {
          inst.renderer.setAnimationLoop(null);
          inst.stop();
        } catch {
          // ignore teardown errors
        }
        mindarRef.current = null;
      }
      setStatus("loading");
      setFoundTarget(null);
    };
    // Re-init only when the actual bundle changes, not on every targets update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleUrl, targetIds]);

  return { status, foundTarget, error };
}
