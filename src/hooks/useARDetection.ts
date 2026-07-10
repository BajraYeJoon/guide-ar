"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { TARGETS, TargetInfo } from "@/data/targets";
import {
  findTargetByClass,
  LOCK_THRESHOLD,
  UNLOCK_THRESHOLD,
} from "@/lib/ar-config";

export type ARStatus =
  | "idle"
  | "loading"
  | "ready"
  | "camera-denied"
  | "scanning"
  | "found";

interface UseARDetectionReturn {
  status: ARStatus;
  setStatus: React.Dispatch<React.SetStateAction<ARStatus>>;
  foundTarget: TargetInfo | null;
  setFoundTarget: React.Dispatch<React.SetStateAction<TargetInfo | null>>;
  bbox: { x: number; y: number; w: number; h: number } | null;
  modelRef: React.MutableRefObject<any | null>;
  detectFrame: () => void;
  reset: () => void;
}

export function useARDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  cameraPaused: boolean
): UseARDetectionReturn {
  const animationFrameRef = useRef<number | null>(null);
  const modelRef = useRef<any | null>(null);

  const detectCountRef = useRef(0);
  const missCountRef = useRef(0);
  const lastDetectedIdRef = useRef<string | null>(null);

  const [status, setStatus] = useState<ARStatus>("idle");
  const [foundTarget, setFoundTarget] = useState<TargetInfo | null>(null);
  const [bbox, setBbox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const reset = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    detectCountRef.current = 0;
    missCountRef.current = 0;
    lastDetectedIdRef.current = null;
    modelRef.current = null;
    setBbox(null);
  }, []);

  const detectFrame = useCallback(() => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      !modelRef.current ||
      cameraPaused
    ) {
      if (!cameraPaused) {
        animationFrameRef.current = requestAnimationFrame(detectFrame);
      }
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (
      video.readyState === 4 &&
      video.videoWidth > 0 &&
      video.videoHeight > 0
    ) {
      if (
        canvas.width !== video.videoWidth ||
        canvas.height !== video.videoHeight
      ) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      ctx?.clearRect(0, 0, canvas.width, canvas.height);

      modelRef.current.detect(video).then((predictions: any[]) => {
        let bestMatch: TargetInfo | null = null;
        let bestScore = 0;
        let bestBbox: { x: number; y: number; w: number; h: number } | null = null;

        for (const prediction of predictions) {
          if (prediction.score > 0.5) {
            const target = findTargetByClass(prediction.class, TARGETS);
            if (target && prediction.score > bestScore) {
              bestMatch = target;
              bestScore = prediction.score;
              const [x, y, w, h] = prediction.bbox;
              bestBbox = { x, y, w, h };
            }
          }
        }

        // Draw target label only — no boxes
        if (bestMatch && bestBbox && ctx) {
          const { x, y, w } = bestBbox;
          const label = bestMatch.name;

          // Measure text
          ctx.font = "bold 24px sans-serif";
          const labelWidth = ctx.measureText(label).width;
          const pillWidth = labelWidth + 32;
          const pillHeight = 44;
          const pillX = x + w / 2 - pillWidth / 2;
          const pillY = y - pillHeight - 12;

          // Pill background
          ctx.fillStyle = "rgba(245, 158, 11, 0.9)";
          ctx.beginPath();
          ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 12);
          ctx.fill();

          // Connecting line
          ctx.strokeStyle = "rgba(245, 158, 11, 0.6)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + w / 2, pillY + pillHeight);
          ctx.lineTo(x + w / 2, y);
          ctx.stroke();

          // Label text
          ctx.fillStyle = "#000";
          ctx.font = "bold 22px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(label, pillX + pillWidth / 2, pillY + 29);
          ctx.textAlign = "left";

          setBbox(bestBbox);
        } else {
          setBbox(null);
        }

        // Stabilization
        if (bestMatch) {
          if (lastDetectedIdRef.current === bestMatch.id) {
            detectCountRef.current++;
            missCountRef.current = 0;
          } else {
            lastDetectedIdRef.current = bestMatch.id;
            detectCountRef.current = 1;
            missCountRef.current = 0;
          }

          if (detectCountRef.current >= LOCK_THRESHOLD) {
            setStatus((prev) => (prev !== "found" ? "found" : prev));
            setFoundTarget((prev) =>
              prev?.id !== bestMatch!.id ? bestMatch : prev
            );
          }
        } else {
          missCountRef.current++;
          detectCountRef.current = 0;

          if (missCountRef.current >= UNLOCK_THRESHOLD) {
            setStatus((prev) => {
              if (prev === "found") {
                setFoundTarget(null);
                lastDetectedIdRef.current = null;
                return "scanning";
              }
              return prev;
            });
          }
        }

        animationFrameRef.current = requestAnimationFrame(detectFrame);
      });
    } else {
      animationFrameRef.current = requestAnimationFrame(detectFrame);
    }
  }, [videoRef, canvasRef, cameraPaused]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    status,
    setStatus,
    foundTarget,
    setFoundTarget,
    bbox,
    modelRef,
    detectFrame,
    reset,
  };
}
