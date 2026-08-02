"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { TargetInfo } from "@/lib/types";
import { getModel } from "@/lib/ar-engine";
import {
  findTargetByClass,
  LOCK_THRESHOLD,
  UNLOCK_THRESHOLD,
} from "@/lib/ar-config";

// Model loads in the background (camera shows immediately); "scanning" begins
// the moment the model is resident. "found" means a target locked on.
export type ARStatus =
  | "loading" // model still downloading/warming up
  | "scanning" // model ready, searching the frame
  | "found"; // a target is locked

interface UseARDetectionReturn {
  status: ARStatus;
  foundTarget: TargetInfo | null;
  bbox: { x: number; y: number; w: number; h: number } | null;
  /** Report a fatal load failure so the view can show the denied/error state. */
  error: boolean;
}

/**
 * Runs coco-ssd over the live video and stabilizes a single "found" target.
 *
 * The detection loop is fully driven by `paused`: when the details overlay is
 * open we pause here (the camera + model stay alive) and resume instantly on
 * close — no remount, no reload, no blank-scanner flash.
 */
export function useARDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  paused: boolean,
  targets: TargetInfo[]
): UseARDetectionReturn {
  const animationFrameRef = useRef<number | null>(null);
  const modelRef = useRef<Awaited<ReturnType<typeof getModel>> | null>(null);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const detectCountRef = useRef(0);
  const missCountRef = useRef(0);
  const lastDetectedIdRef = useRef<string | null>(null);

  const [status, setStatus] = useState<ARStatus>("loading");
  const [foundTarget, setFoundTarget] = useState<TargetInfo | null>(null);
  const [bbox, setBbox] = useState<
    { x: number; y: number; w: number; h: number } | null
  >(null);
  const [error, setError] = useState(false);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [canvasRef]);

  const detectFrame = useCallback(
    function detectFrame() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const model = modelRef.current;

      // If paused or not ready yet, stop the loop entirely; a fresh loop is
      // (re)started by the effect below when conditions change.
      if (!video || !canvas || !model || pausedRef.current) return;

      const ctx = canvas.getContext("2d");

      if (video.readyState === 4 && video.videoWidth > 0) {
        if (
          canvas.width !== video.videoWidth ||
          canvas.height !== video.videoHeight
        ) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        ctx?.clearRect(0, 0, canvas.width, canvas.height);

        model.detect(video).then((predictions) => {
          if (pausedRef.current) return; // overlay opened mid-inference

          let bestMatch: TargetInfo | null = null;
          let bestScore = 0;
          let bestBbox: { x: number; y: number; w: number; h: number } | null =
            null;

          for (const prediction of predictions) {
            if (prediction.score > 0.5) {
              const target = findTargetByClass(
                prediction.class,
                targetsRef.current
              );
              if (target && prediction.score > bestScore) {
                bestMatch = target;
                bestScore = prediction.score;
                const [x, y, w, h] = prediction.bbox;
                bestBbox = { x, y, w, h };
              }
            }
          }

          // Draw a floating label pill above the match — no bounding boxes.
          if (bestMatch && bestBbox && ctx) {
            const { x, y, w } = bestBbox;
            const label = bestMatch.name;

            ctx.font = "bold 24px sans-serif";
            const labelWidth = ctx.measureText(label).width;
            const pillWidth = labelWidth + 32;
            const pillHeight = 44;
            const pillX = x + w / 2 - pillWidth / 2;
            const pillY = y - pillHeight - 12;

            ctx.fillStyle = "rgba(245, 158, 11, 0.9)";
            ctx.beginPath();
            ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 12);
            ctx.fill();

            ctx.strokeStyle = "rgba(245, 158, 11, 0.6)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + w / 2, pillY + pillHeight);
            ctx.lineTo(x + w / 2, y);
            ctx.stroke();

            ctx.fillStyle = "#000";
            ctx.font = "bold 22px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(label, pillX + pillWidth / 2, pillY + 29);
            ctx.textAlign = "left";

            setBbox(bestBbox);
          } else {
            setBbox(null);
          }

          // Stabilization: require N consecutive hits to lock, N misses to release.
          if (bestMatch) {
            if (lastDetectedIdRef.current === bestMatch._id) {
              detectCountRef.current++;
            } else {
              lastDetectedIdRef.current = bestMatch._id;
              detectCountRef.current = 1;
            }
            missCountRef.current = 0;

            if (detectCountRef.current >= LOCK_THRESHOLD) {
              setStatus((prev) => (prev !== "found" ? "found" : prev));
              setFoundTarget((prev) =>
                prev?._id !== bestMatch!._id ? bestMatch : prev
              );
            }
          } else {
            missCountRef.current++;
            detectCountRef.current = 0;

            if (missCountRef.current >= UNLOCK_THRESHOLD) {
              lastDetectedIdRef.current = null;
              setStatus((prev) => (prev === "found" ? "scanning" : prev));
              setFoundTarget((prev) => (prev ? null : prev));
            }
          }

          if (!pausedRef.current) {
            animationFrameRef.current = requestAnimationFrame(detectFrame);
          }
        });
      } else {
        animationFrameRef.current = requestAnimationFrame(detectFrame);
      }
    },
    [videoRef, canvasRef]
  );

  // Load the (cached, shared) model once on mount.
  useEffect(() => {
    let cancelled = false;
    getModel()
      .then((model) => {
        if (cancelled) return;
        modelRef.current = model;
        setStatus((prev) => (prev === "loading" ? "scanning" : prev));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Start/stop the loop whenever pause state or model readiness changes.
  useEffect(() => {
    if (!paused && modelRef.current && status !== "loading") {
      animationFrameRef.current = requestAnimationFrame(detectFrame);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [paused, status, detectFrame]);

  // Clear any stale label when we pause (freeze the frame cleanly).
  useEffect(() => {
    if (paused) clearCanvas();
  }, [paused, clearCanvas]);

  return { status, foundTarget, bbox, error };
}
