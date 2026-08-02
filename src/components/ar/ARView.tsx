"use client";

import React, { useEffect, useState } from "react";
import { useCamera } from "@/hooks/useCamera";
import { useARDetection } from "@/hooks/useARDetection";
import { useTargets } from "@/hooks/useTargets";
import { LockSheet } from "./BottomSheet";
import { ScanOverlay } from "./ScanOverlay";
import { TargetDetail } from "./TargetDetail";
import { CameraDeniedOverlay, PreparingChip, StatusBar } from "./Overlays";

interface ARViewProps {
  onBack: () => void;
}

/**
 * Live AR experience. The camera starts immediately and the detection model
 * loads in parallel (progressive startup). Tapping a locked target opens the
 * detail view as an in-place overlay: detection pauses but the camera and model
 * stay mounted, so returning is instant with no reload / blank-scanner flash.
 */
export function ARView({ onBack }: ARViewProps) {
  const { targets } = useTargets();
  const camera = useCamera();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);

  const detailOpen = detailId !== null;
  const detection = useARDetection(
    camera.videoRef,
    camera.canvasRef,
    detailOpen, // pause detection while the detail overlay is open
    targets
  );

  // Start the camera as soon as the view mounts (independent of model load).
  useEffect(() => {
    let cancelled = false;
    camera.start().catch(() => {
      if (!cancelled) setCameraError(true);
    });
    return () => {
      cancelled = true;
      camera.stop();
    };
    // camera is a stable ref-based object; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pause/resume the actual camera track alongside the detail overlay so we
  // aren't decoding video frames behind an opaque page.
  useEffect(() => {
    if (detailOpen) camera.pause();
    else camera.resume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailOpen]);

  const handleBack = () => {
    camera.stop();
    onBack();
  };

  const detailTarget = detailId
    ? targets.find((t) => t._id === detailId) ?? null
    : null;

  const denied = cameraError || detection.error;

  return (
    <div className="w-full h-dvh bg-black text-zinc-100 relative overflow-hidden font-sans select-none flex flex-col">
      {/* Camera feed */}
      <video
        ref={camera.videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* Detection label overlay */}
      <canvas
        ref={camera.canvasRef}
        className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none"
      />

      {/* Top status bar */}
      <StatusBar
        status={denied ? "camera-denied" : detection.status}
        onBack={handleBack}
      />

      {/* Progressive, non-blocking "preparing detection" chip */}
      {!denied && detection.status === "loading" && <PreparingChip />}

      {/* Camera / model failure */}
      {denied && <CameraDeniedOverlay onBack={handleBack} />}

      {/* Scan reticle while searching */}
      {!denied && detection.status === "scanning" && <ScanOverlay />}

      {/* Lock sheet — shows when a target is found */}
      {!detailOpen && (
        <LockSheet
          foundTarget={detection.foundTarget}
          onViewDetails={() =>
            detection.foundTarget && setDetailId(detection.foundTarget._id)
          }
        />
      )}

      {/* In-place detail overlay — camera & model stay alive underneath */}
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
