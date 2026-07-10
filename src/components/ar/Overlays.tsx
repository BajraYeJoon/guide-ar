"use client";

import React from "react";
import { Camera, Loader2, Radio } from "lucide-react";

export function LoadingOverlay() {
  return (
    <div className="absolute inset-0 bg-zinc-950 z-20 flex flex-col items-center justify-center text-center p-6 backdrop-blur-sm">
      <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
      <h1 className="text-xl font-extrabold text-white">Loading AI Engine...</h1>
      <p className="text-xs text-zinc-400 mt-2 max-w-xs leading-relaxed">
        Downloading detection model. This may take a moment on first load.
      </p>
      <div className="mt-4 w-48 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full animate-pulse"
          style={{ width: "60%" }}
        />
      </div>
    </div>
  );
}

export function ReadyOverlay() {
  return (
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
  );
}

interface CameraDeniedOverlayProps {
  onBack: () => void;
}

export function CameraDeniedOverlay({ onBack }: CameraDeniedOverlayProps) {
  return (
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
        onClick={onBack}
        className="mt-4 px-6 py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 transition-all"
      >
        Back to Info
      </button>
    </div>
  );
}

interface StatusBarProps {
  status: string;
  onBack: () => void;
}

export function StatusBar({ status, onBack }: StatusBarProps) {
  return (
    <div className="absolute top-4 left-4 right-4 z-30 pointer-events-none flex justify-between items-start">
      <button
        onClick={onBack}
        className="px-4 py-2 rounded-full bg-zinc-950/80 backdrop-blur-md border border-zinc-800 text-xs font-bold text-zinc-300 flex items-center gap-2 shadow-lg pointer-events-auto hover:bg-zinc-800 transition-all"
      >
        ← Back
      </button>
      <div className="px-4 py-2 rounded-full bg-zinc-950/80 backdrop-blur-md border border-zinc-800 text-xs font-bold text-zinc-300 flex items-center gap-2 shadow-lg">
        <span
          className={`w-2 h-2 rounded-full ${
            status === "found"
              ? "bg-emerald-500"
              : status === "scanning"
              ? "bg-amber-500 animate-pulse"
              : status === "ready"
              ? "bg-blue-500"
              : "bg-zinc-500"
          }`}
        />
        {status === "loading" && "Loading engine..."}
        {status === "ready" && "Engine ready!"}
        {status === "camera-denied" && "Camera required"}
        {status === "scanning" && "Scanning..."}
      </div>
    </div>
  );
}
