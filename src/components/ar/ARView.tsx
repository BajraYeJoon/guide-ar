"use client";

import React, { useState } from "react";
import { useMindARTracking } from "@/hooks/useMindARTracking";
import { useTargets } from "@/hooks/useTargets";
import { useArBundle } from "@/hooks/useArBundle";
import { LockSheet } from "./BottomSheet";
import { ScanOverlay } from "./ScanOverlay";
import { TargetDetail } from "./TargetDetail";
import { CameraDeniedOverlay, PreparingChip, StatusBar } from "./Overlays";

interface ARViewProps {
  onBack: () => void;
}

/**
 * Live AR experience powered by MindAR image tracking. MindAR owns the camera
 * and injects its own <video>/<canvas> into the container div; when it locks
 * onto a target's reference image it fires found/lost events that drive the
 * lock sheet. Tapping a locked target opens the detail view as an in-place
 * overlay: tracking pauses (but stays mounted) so returning is instant with no
 * blank-scanner flash.
 */
export function ARView({ onBack }: ARViewProps) {
  const { targets } = useTargets();
  const { bundle, loading: bundleLoading } = useArBundle();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const detailOpen = detailId !== null;
  const tracking = useMindARTracking(
    containerRef,
    detailOpen, // pause updates while the detail overlay is open
    targets,
    bundle
  );

  const handleBack = () => {
    onBack();
  };

  const detailTarget = detailId
    ? targets.find((t) => t._id === detailId) ?? null
    : null;

  const denied = tracking.error;

  // No compiled tracking bundle yet — guide the user instead of a dead scanner.
  const notBuilt =
    !bundleLoading && (!bundle || bundle.targetIds.length === 0);

  return (
    <div className="w-full h-dvh bg-black text-zinc-100 relative overflow-hidden font-sans select-none flex flex-col">
      {/* MindAR mounts its camera video + canvas inside this container. */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Top status bar */}
      <StatusBar
        status={denied ? "camera-denied" : tracking.status}
        onBack={handleBack}
      />

      {/* Progressive, non-blocking "preparing" chip while MindAR starts up */}
      {!denied && !notBuilt && tracking.status === "loading" && <PreparingChip />}

      {/* Camera / tracking failure */}
      {denied && <CameraDeniedOverlay onBack={handleBack} />}

      {/* Tracking not built yet */}
      {!denied && notBuilt && (
        <div className="absolute inset-0 z-40 bg-zinc-950/95 flex flex-col items-center justify-center text-center p-6">
          <h1 className="text-lg font-extrabold text-white">
            AR tracking not ready
          </h1>
          <p className="text-xs text-zinc-400 mt-2 max-w-xs leading-relaxed">
            No objects have been prepared for the camera yet. Ask an admin to add
            reference images and tap “Build AR tracking”.
          </p>
          <button
            onClick={handleBack}
            className="mt-4 px-6 py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 transition-all"
          >
            Back
          </button>
        </div>
      )}

      {/* Scan reticle while searching */}
      {!denied && !notBuilt && tracking.status === "scanning" && <ScanOverlay />}

      {/* Lock sheet — shows when a target is found */}
      {!detailOpen && (
        <LockSheet
          foundTarget={tracking.foundTarget}
          onViewDetails={() =>
            tracking.foundTarget && setDetailId(tracking.foundTarget._id)
          }
        />
      )}

      {/* In-place detail overlay — camera & tracking stay alive underneath */}
      {detailOpen && detailTarget && (
        <div className="absolute inset-0 z-[60] overflow-y-auto animate-fadeIn">
          <TargetDetail
            target={detailTarget}
            onBack={() => setDetailId(null)}
            backLabel="Back to Live AR"
          />
        </div>
      )}
    </div>
  );
}
