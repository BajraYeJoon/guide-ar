"use client";

import React, { useEffect, useCallback } from "react";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { useCamera } from "@/hooks/useCamera";
import { useARDetection } from "@/hooks/useARDetection";
import { LockSheet } from "./BottomSheet";
import { ScanOverlay } from "./ScanOverlay";
import {
  LoadingOverlay,
  ReadyOverlay,
  CameraDeniedOverlay,
  StatusBar,
} from "./Overlays";

interface ARViewProps {
  onBack: () => void;
  onViewDetails: (targetId: string) => void;
}

export function ARView({ onBack, onViewDetails }: ARViewProps) {
  const camera = useCamera();
  const detection = useARDetection(
    camera.videoRef,
    camera.canvasRef,
    camera.isPaused
  );

  const initAR = useCallback(async () => {
    detection.setStatus("loading");

    try {
      await tf.setBackend("webgl");
      await tf.ready();

      const model = await cocoSsd.load({ base: "lite_mobilenet_v2" });
      detection.modelRef.current = model;
      detection.setStatus("ready");

      await camera.start();
      detection.setStatus("scanning");
    } catch (err) {
      console.error("AR init error:", err);
      detection.setStatus("camera-denied");
    }
  }, [camera, detection]);

  useEffect(() => {
    initAR();
    return () => {
      camera.stop();
      detection.reset();
    };
  }, []);

  // Resume detection when camera unpauses
  useEffect(() => {
    if (!camera.isPaused && detection.status === "scanning") {
      detection.detectFrame();
    }
  }, [camera.isPaused, detection.status]);

  const handleBack = () => {
    camera.stop();
    detection.reset();
    onBack();
  };

  const handleViewDetails = () => {
    if (detection.foundTarget) {
      camera.stop();
      onViewDetails(detection.foundTarget.id);
    }
  };

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

      {/* Detection canvas overlay */}
      <canvas
        ref={camera.canvasRef}
        className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none"
      />

      {/* Status bar */}
      <StatusBar status={detection.status} onBack={handleBack} />

      {/* Overlays */}
      {detection.status === "loading" && <LoadingOverlay />}
      {detection.status === "ready" && <ReadyOverlay />}
      {detection.status === "camera-denied" && (
        <CameraDeniedOverlay onBack={handleBack} />
      )}
      {detection.status === "scanning" && <ScanOverlay />}

      {/* Lock sheet - only shows when object found */}
      <LockSheet
        foundTarget={detection.foundTarget}
        onViewDetails={handleViewDetails}
      />
    </div>
  );
}
