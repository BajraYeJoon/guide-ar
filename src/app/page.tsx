"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { TARGETS, TargetInfo } from "@/data/targets";
import {
  Camera,
  Sparkles,
  ChevronDown,
  BookOpen,
  Info,
  Loader2,
  ArrowLeft,
  Radio,
  X,
} from "lucide-react";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

type ViewMode = "info" | "ar";

const CLASS_TO_TARGET: Record<string, string> = {
  mouse: "mouse",
  bottle: "bottle",
  cup: "bottle",
};

const LOCK_THRESHOLD = 3;
const UNLOCK_THRESHOLD = 5;

export default function ARPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const detectCountRef = useRef(0);
  const missCountRef = useRef(0);
  const lastDetectedIdRef = useRef<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("info");
  const [arStatus, setArStatus] = useState<
    "idle" | "loading" | "ready" | "camera-denied" | "scanning" | "found"
  >("idle");
  const [foundTarget, setFoundTarget] = useState<TargetInfo | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<TargetInfo>(TARGETS[0]);

  // Bottom sheet state
  const [sheetState, setSheetState] = useState<"peek" | "half" | "full">("peek");
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartState = useRef<"peek" | "half" | "full">("peek");

  // Camera paused state
  const [cameraPaused, setCameraPaused] = useState(false);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    detectCountRef.current = 0;
    missCountRef.current = 0;
    lastDetectedIdRef.current = null;
  }, []);

  const pauseCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const video = videoRef.current;
      video.pause();
      // Pause all tracks without stopping them (allows resume)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      setCameraPaused(true);
    }
  }, []);

  const resumeCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.enabled = true;
        });
      }
      videoRef.current.play();
      setCameraPaused(false);
    }
  }, []);

  const startAR = async () => {
    setViewMode("ar");
    setArStatus("loading");
    setSheetState("peek");
    detectCountRef.current = 0;
    missCountRef.current = 0;
    lastDetectedIdRef.current = null;

    try {
      await tf.setBackend("webgl");
      await tf.ready();

      const model = await cocoSsd.load({ base: "lite_mobilenet_v2" });
      modelRef.current = model;

      // Model loaded - show ready state
      setArStatus("ready");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;

      video.onloadedmetadata = () => {
        video.play().then(() => {
          setArStatus("scanning");

          if (canvasRef.current) {
            canvasRef.current.width = video.videoWidth;
            canvasRef.current.height = video.videoHeight;
          }

          detectFrame();
        });
      };
    } catch (err) {
      console.error("AR init error:", err);
      setArStatus("camera-denied");
    }
  };

  const stopAR = () => {
    cleanup();
    setViewMode("info");
    setArStatus("idle");
    setFoundTarget(null);
    setSheetState("peek");
    setCameraPaused(false);
  };

  const findTargetByClass = (className: string): TargetInfo | null => {
    const targetId = CLASS_TO_TARGET[className];
    if (!targetId) return null;
    return TARGETS.find((t) => t.id === targetId) ?? null;
  };

  const detectFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !modelRef.current || cameraPaused) {
      if (!cameraPaused) {
        animationFrameRef.current = requestAnimationFrame(detectFrame);
      }
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (video.readyState === 4 && video.videoWidth > 0 && video.videoHeight > 0) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      ctx?.clearRect(0, 0, canvas.width, canvas.height);

      const predictions = await modelRef.current.detect(video);

      let bestMatch: TargetInfo | null = null;
      let bestScore = 0;

      for (const prediction of predictions) {
        if (prediction.score > 0.5) {
          const target = findTargetByClass(prediction.class);
          if (target && prediction.score > bestScore) {
            bestMatch = target;
            bestScore = prediction.score;
          }
        }
      }

      // Draw predictions
      predictions.forEach((prediction) => {
        if (prediction.score > 0.5) {
          const [x, y, width, height] = prediction.bbox;
          const isTarget = CLASS_TO_TARGET[prediction.class] !== undefined;

          if (ctx) {
            ctx.strokeStyle = isTarget ? "#f59e0b" : "rgba(255, 255, 255, 0.2)";
            ctx.lineWidth = isTarget ? 4 : 2;

            if (isTarget) {
              const cornerLength = 20;
              ctx.beginPath();
              ctx.moveTo(x, y + cornerLength);
              ctx.lineTo(x, y);
              ctx.lineTo(x + cornerLength, y);
              ctx.moveTo(x + width - cornerLength, y);
              ctx.lineTo(x + width, y);
              ctx.lineTo(x + width, y + cornerLength);
              ctx.moveTo(x + width, y + height - cornerLength);
              ctx.lineTo(x + width, y + height);
              ctx.lineTo(x + width - cornerLength, y + height);
              ctx.moveTo(x + cornerLength, y + height);
              ctx.lineTo(x, y + height);
              ctx.lineTo(x, y + height - cornerLength);
              ctx.stroke();

              ctx.fillStyle = "#f59e0b";
              ctx.font = "bold 16px sans-serif";
              ctx.fillText(
                `${prediction.class}: ${Math.round(prediction.score * 100)}%`,
                x,
                y > 20 ? y - 10 : y + 20
              );
            } else {
              ctx.strokeRect(x, y, width, height);
              ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
              ctx.font = "12px sans-serif";
              ctx.fillText(prediction.class, x, y > 15 ? y - 5 : y + 15);
            }
          }
        }
      });

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
          setArStatus((prev) => {
            if (prev !== "found") return "found";
            return prev;
          });
          setFoundTarget((prev) => {
            if (prev?.id !== bestMatch!.id) return bestMatch;
            return prev;
          });
        }
      } else {
        missCountRef.current++;
        detectCountRef.current = 0;

        if (missCountRef.current >= UNLOCK_THRESHOLD) {
          setArStatus((prev) => {
            if (prev === "found") {
              setFoundTarget(null);
              lastDetectedIdRef.current = null;
              return "scanning";
            }
            return prev;
          });
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(detectFrame);
  };

  // Resume detection when camera unpauses
  useEffect(() => {
    if (!cameraPaused && viewMode === "ar" && arStatus === "scanning") {
      detectFrame();
    }
  }, [cameraPaused, viewMode, arStatus]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Sheet drag handlers
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    dragStartState.current = sheetState;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const delta = dragStartY.current - clientY;
    const threshold = window.innerHeight * 0.1;

    if (delta > threshold && dragStartState.current === "peek") {
      setSheetState("half");
    } else if (delta > threshold * 2 && dragStartState.current === "half") {
      setSheetState("full");
      pauseCamera();
    } else if (delta < -threshold && dragStartState.current === "full") {
      setSheetState("half");
      resumeCamera();
    } else if (delta < -threshold && dragStartState.current === "half") {
      setSheetState("peek");
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const sheetHeight = sheetState === "peek" ? "h-[40vh]" : sheetState === "half" ? "h-[60vh]" : "h-[85vh]";

  if (viewMode === "info") {
    return (
      <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 font-sans">
        <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-lg font-bold text-white">Temple Guide</h1>
            <button
              onClick={startAR}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 transition-all"
            >
              <Radio className="w-4 h-4" />
              Live AR
            </button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {TARGETS.map((target) => (
              <button
                key={target.id}
                onClick={() => setSelectedTarget(target)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedTarget.id === target.id
                    ? "bg-amber-500 text-zinc-950"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {target.name}
              </button>
            ))}
          </div>

          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
            <div className="aspect-video bg-zinc-800 flex items-center justify-center">
              <img
                src={selectedTarget.referenceImage}
                alt={selectedTarget.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-5">
              <h2 className="text-xl font-extrabold text-white mb-2">
                {selectedTarget.name}
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {selectedTarget.description}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-3">
              Specifications
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {selectedTarget.specs.map((spec, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-zinc-900 border border-zinc-800"
                >
                  <span className="text-[10px] text-zinc-500 uppercase font-medium block">
                    {spec.label}
                  </span>
                  <span className="text-xs font-bold text-zinc-200 mt-1 block">
                    {spec.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-3">
              History
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {selectedTarget.history}
            </p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-amber-500 mb-2">
              How to use Live AR
            </h3>
            <ol className="text-sm text-zinc-400 space-y-2 list-decimal list-inside">
              <li>Tap "Live AR" to activate camera</li>
              <li>Point your camera at the object</li>
              <li>Watch for the amber marker to appear</li>
              <li>Swipe up the info sheet for details</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // AR Mode
  return (
    <div className="w-full h-screen bg-black text-zinc-100 relative overflow-hidden font-sans select-none flex flex-col">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none"
      />

      {/* Status bar */}
      <div className="absolute top-4 left-4 right-4 z-30 pointer-events-none flex justify-between items-start">
        <button
          onClick={stopAR}
          className="px-4 py-2 rounded-full bg-zinc-950/80 backdrop-blur-md border border-zinc-800 text-xs font-bold text-zinc-300 flex items-center gap-2 shadow-lg pointer-events-auto hover:bg-zinc-800 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="px-4 py-2 rounded-full bg-zinc-950/80 backdrop-blur-md border border-zinc-800 text-xs font-bold text-zinc-300 flex items-center gap-2 shadow-lg">
          <span
            className={`w-2 h-2 rounded-full ${
              arStatus === "found"
                ? "bg-emerald-500"
                : arStatus === "scanning"
                ? "bg-amber-500 animate-pulse"
                : arStatus === "ready"
                ? "bg-blue-500"
                : "bg-zinc-500"
            }`}
          />
          {arStatus === "loading" && "Loading engine..."}
          {arStatus === "ready" && "Engine ready!"}
          {arStatus === "camera-denied" && "Camera required"}
          {arStatus === "scanning" && "Scanning..."}
          {arStatus === "found" && "Locked!"}
        </div>
      </div>

      {/* Loading overlay */}
      {arStatus === "loading" && (
        <div className="absolute inset-0 bg-zinc-950 z-20 flex flex-col items-center justify-center text-center p-6 backdrop-blur-sm">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
          <h1 className="text-xl font-extrabold text-white">
            Loading AI Engine...
          </h1>
          <p className="text-xs text-zinc-400 mt-2 max-w-xs leading-relaxed">
            Downloading detection model. This may take a moment on first load.
          </p>
          <div className="mt-4 w-48 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      )}

      {/* Engine ready notification */}
      {arStatus === "ready" && (
        <div className="absolute inset-0 bg-zinc-950 z-20 flex flex-col items-center justify-center text-center p-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
            <Radio className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-xl font-extrabold text-white mb-2">
            AR Engine Ready!
          </h1>
          <p className="text-xs text-zinc-400 max-w-xs leading-relaxed mb-6">
            Camera is starting. Point at a mouse or bottle to detect.
          </p>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Starting camera...
          </div>
        </div>
      )}

      {/* Camera denied */}
      {arStatus === "camera-denied" && (
        <div className="absolute inset-0 bg-zinc-950 z-20 flex flex-col items-center justify-center text-center p-6">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
            <Camera className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold text-white">
            Camera Access Required
          </h1>
          <p className="text-xs text-zinc-400 mt-2 max-w-sm leading-relaxed">
            Grant camera permission in browser settings to use Live AR.
          </p>
          <button
            onClick={stopAR}
            className="mt-4 px-6 py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 transition-all"
          >
            Back to Info
          </button>
        </div>
      )}

      {/* Scanning guide */}
      {arStatus === "scanning" && sheetState === "peek" && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          <div className="w-64 h-64 border border-dashed border-white/20 rounded-3xl relative">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-[scan_2s_ease-in-out_infinite]" />

            <style
              dangerouslySetInnerHTML={{
                __html: `
                  @keyframes scan {
                    0% { top: 0; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                  }
                `,
              }}
            />
          </div>

          <div className="absolute bottom-8 left-6 right-6 flex justify-center">
            <div className="px-5 py-3 rounded-2xl bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 text-xs text-zinc-300 text-center shadow-2xl leading-relaxed">
              <span className="font-bold text-amber-500 block mb-1">
                Point at mouse or bottle
              </span>
              Swipe up for details after detection.
            </div>
          </div>
        </div>
      )}

      {/* Bottom sheet - always present in AR mode */}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-out ${
          isDragging ? "" : "transition-transform"
        } ${sheetHeight}`}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
      >
        <div className="h-full bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
            <div className="w-10 h-1 rounded-full bg-zinc-700" />
          </div>

          {/* Found target header */}
          {foundTarget ? (
            <div className="px-5 pb-2 flex-shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-amber-500 font-bold uppercase tracking-wider mb-1">
                <Sparkles className="w-4 h-4 animate-pulse" />
                Target Identified
              </div>
              <h2 className="text-xl font-extrabold text-white">
                {foundTarget.name}
              </h2>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                {foundTarget.description}
              </p>
            </div>
          ) : (
            <div className="px-5 pb-2 flex-shrink-0">
              <h2 className="text-lg font-bold text-zinc-400">
                {cameraPaused ? "Camera paused" : "Scanning for objects..."}
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                {cameraPaused
                  ? "Swipe down to resume camera"
                  : "Point at a mouse or bottle"}
              </p>
            </div>
          )}

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
            {foundTarget ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-2">
                    Specifications
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {foundTarget.specs.map((spec, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60 flex flex-col"
                      >
                        <span className="text-[9px] text-zinc-500 uppercase font-medium">
                          {spec.label}
                        </span>
                        <span className="text-[11px] font-bold text-zinc-200 mt-0.5">
                          {spec.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-2">
                    History
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {foundTarget.history}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Info className="w-8 h-8 text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-500">
                  Object information will appear here after detection.
                </p>
              </div>
            )}
          </div>

          {/* Camera status indicator */}
          {cameraPaused && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-xs text-amber-500 font-medium">
              Camera paused for performance
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
