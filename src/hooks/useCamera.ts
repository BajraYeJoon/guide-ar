"use client";

import { useRef, useState, useCallback } from "react";
import { CAMERA_CONSTRAINTS } from "@/lib/ar-config";

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isPaused: boolean;
  start: () => Promise<MediaStream>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const start = useCallback(async (): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
    streamRef.current = stream;

    const video = videoRef.current;
    if (!video) throw new Error("Video element not mounted");

    video.srcObject = stream;

    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play().then(() => {
          if (canvasRef.current) {
            canvasRef.current.width = video.videoWidth;
            canvasRef.current.height = video.videoHeight;
          }
          resolve(stream);
        });
      };
    });
  }, []);

  const pause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => (t.enabled = false));
    }
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => (t.enabled = true));
    }
    if (videoRef.current) {
      videoRef.current.play();
    }
    setIsPaused(false);
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsPaused(false);
  }, []);

  return { videoRef, canvasRef, isPaused, start, pause, resume, stop };
}
