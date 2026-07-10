"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { TARGETS, TargetInfo } from "@/data/targets";
import { Camera, Sparkles, ChevronDown, BookOpen, Info, Loader2, ArrowLeft, Eye } from "lucide-react";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

type ViewMode = "info" | "ar";

// Map COCO-SSD class names to our target IDs
const CLASS_TO_TARGET: Record<string, string> = {
  mouse: "mouse",
  bottle: "bottle",
  cup: "bottle",
};

// Stabilization: require N consecutive frames before state change
const LOCK_THRESHOLD = 3;   // frames to confirm detection
const UNLOCK_THRESHOLD = 5; // frames to confirm loss

export default function ARPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);

  // Stabilization counters
  const detectCountRef = useRef(0);
  const missCountRef = useRef(0);
  const lastDetectedIdRef = useRef<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("info");
  const [arStatus, setArStatus] = useState<
    "idle" | "loading" | "camera-denied" | "scanning" | "found"
  >("idle");
  const [foundTarget, setFoundTarget] = useState<TargetInfo | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<TargetInfo>(TARGETS[0]);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    detectCountRef.current = 0;
    missCountRef.current = 0;
    lastDetectedIdRef.current = null;
  }, []);

  const startAR = async () => {
    setViewMode("ar");
    setArStatus("loading");
    detectCountRef.current = 0;
    missCountRef.current = 0;
    lastDetectedIdRef.current = null;

    try {
      await tf.setBackend("webgl");
      await tf.ready();

      const model = await cocoSsd.load({ base: "lite_mobilenet_v2" });
      modelRef.current = model;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

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
    setShowDetails(false);
  };

  const findTargetByClass = (className: string): TargetInfo | null => {
    const targetId = CLASS_TO_TARGET[className];
    if (!targetId) return null;
    return TARGETS.find((t) => t.id === targetId) ?? null;
  };

  const detectFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !modelRef.current) return;

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

      // Find best matching target from predictions
      let bestMatch: TargetInfo | null = null;
      let bestScore = 0;
      let detectedClass = "";

      for (const prediction of predictions) {
        if (prediction.score > 0.5) {
          const target = findTargetByClass(prediction.class);
          if (target && prediction.score > bestScore) {
            bestMatch = target;
            bestScore = prediction.score;
            detectedClass = prediction.class;
          }
        }
      }

      // Draw all predictions
      predictions.forEach((prediction) => {
        if (prediction.score > 0.5) {
          const [x, y, width, height] = prediction.bbox;
          const isTarget = CLASS_TO_TARGET[prediction.class] !== undefined;

          if (ctx) {
            ctx.strokeStyle = isTarget ? "#f59e0b" : "rgba(255, 255, 255, 0.2)";
            ctx.lineWidth = isTarget ? 4 : 2;

            if (isTarget) {
              // Draw corner brackets for targets
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
              // Draw faded box for non-targets
              ctx.strokeRect(x, y, width, height);
              ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
              ctx.font = "12px sans-serif";
              ctx.fillText(prediction.class, x, y > 15 ? y - 5 : y + 15);
            }
          }
        }
      });

      // Stabilization logic
      if (bestMatch) {
        // Same target as before? Increment counter
        if (lastDetectedIdRef.current === bestMatch.id) {
          detectCountRef.current++;
          missCountRef.current = 0;
        } else {
          // Different target or first detection
          lastDetectedIdRef.current = bestMatch.id;
          detectCountRef.current = 1;
          missCountRef.current = 0;
        }

        // Lock if enough consecutive frames
        if (detectCountRef.current >= LOCK_THRESHOLD) {
          setArStatus((prev) => {
            if (prev !== "found") {
              setFoundTarget(bestMatch);
              return "found";
            }
            return prev;
          });
          // Update target if already locked (handles target switching)
          setFoundTarget((prev) => {
            if (prev?.id !== bestMatch!.id) return bestMatch;
            return prev;
          });
        }
      } else {
        // No target detected
        missCountRef.current++;
        detectCountRef.current = 0;

        // Only unlock after enough missed frames
        if (missCountRef.current >= UNLOCK_THRESHOLD) {
          setArStatus((prev) => {
            if (prev === "found") {
              setFoundTarget(null);
              setShowDetails(false);
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

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

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
              <Eye className="w-4 h-4" />
              Start AR
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
              How to use AR
            </h3>
            <ol className="text-sm text-zinc-400 space-y-2 list-decimal list-inside">
              <li>Tap "Start AR" to activate camera</li>
              <li>Point your camera at the object</li>
              <li>Watch for the amber marker to appear</li>
              <li>Tap the info panel for details</li>
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

      <div className="absolute top-4 left-4 right-4 z-30 pointer-events-none flex justify-between items-center">
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
                : "bg-zinc-500"
            }`}
          />
          {arStatus === "loading" && "Loading AI Engine..."}
          {arStatus === "camera-denied" && "Camera Access Required"}
          {arStatus === "scanning" && "Scanning environment..."}
          {arStatus === "found" && "Target Locked!"}
        </div>
      </div>

      {arStatus === "loading" && (
        <div className="absolute inset-0 bg-zinc-950 z-20 flex flex-col items-center justify-center text-center p-6 backdrop-blur-sm">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
          <h1 className="text-xl font-extrabold text-white">
            Initializing AR Engine...
          </h1>
          <p className="text-xs text-zinc-400 mt-2 max-w-xs leading-relaxed">
            Loading detection models and requesting camera access.
          </p>
        </div>
      )}

      {arStatus === "camera-denied" && (
        <div className="absolute inset-0 bg-zinc-950 z-20 flex flex-col items-center justify-center text-center p-6">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
            <Camera className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold text-white">
            Camera Access Required
          </h1>
          <p className="text-xs text-zinc-400 mt-2 max-w-sm leading-relaxed">
            AR scanning needs camera permission. Grant permission in your
            browser settings and reload.
          </p>
          <button
            onClick={stopAR}
            className="mt-4 px-6 py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 transition-all"
          >
            Back to Info
          </button>
        </div>
      )}

      {arStatus === "scanning" && (
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

          <div className="absolute bottom-24 left-6 right-6 flex justify-center">
            <div className="px-5 py-3 rounded-2xl bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 text-xs text-zinc-300 text-center shadow-2xl leading-relaxed">
              <span className="font-bold text-amber-500 block mb-1">
                Point your camera at a mouse or bottle
              </span>
              The AI will detect and identify the object.
            </div>
          </div>
        </div>
      )}

      {arStatus === "found" && foundTarget && (
        <div className="absolute bottom-0 left-0 right-0 z-50 pointer-events-auto animate-fadeIn">
          <div className="bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col">
            <div className="p-5 pb-0">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-amber-500 font-bold uppercase tracking-wider mb-1">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    Target Identified
                  </div>
                  <h2 className="text-xl font-extrabold text-white">
                    {foundTarget.name}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed max-w-sm">
                    {foundTarget.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 pt-4">
              <div className="grid grid-cols-3 gap-2">
                {foundTarget.specs
                  .slice(0, showDetails ? undefined : 3)
                  .map((spec, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60 flex flex-col"
                    >
                      <span className="text-[9px] text-zinc-500 uppercase font-medium">
                        {spec.label}
                      </span>
                      <span className="text-[11px] font-bold text-zinc-200 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                        {spec.value}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-zinc-400 hover:text-amber-500 transition-colors border-t border-zinc-900"
            >
              <BookOpen className="w-3.5 h-3.5" />
              {showDetails ? "Hide History" : "Show History & Details"}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  showDetails ? "rotate-180" : ""
                }`}
              />
            </button>

            {showDetails && (
              <div className="px-5 pb-5 border-t border-zinc-900 pt-4 animate-fadeIn">
                <div className="flex items-center gap-1.5 text-xs text-amber-500 font-bold uppercase tracking-wider mb-2">
                  <Info className="w-3.5 h-3.5" />
                  History
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {foundTarget.history}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
