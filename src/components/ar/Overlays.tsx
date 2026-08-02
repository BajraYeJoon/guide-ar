"use client";

import React from "react";
import { Camera, Loader2 } from "lucide-react";

/**
 * Small, non-blocking indicator shown while the detection model warms up.
 * Unlike a full-screen loader, the live camera is already visible behind it,
 * so the AR view feels instant.
 */
export function PreparingChip() {
  return (
    <div className="absolute inset-x-0 bottom-24 z-20 pointer-events-none flex justify-center">
      <div className="px-4 py-2.5 rounded-full bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 text-xs font-medium text-zinc-300 flex items-center gap-2 shadow-lg">
        <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
        Preparing detection…
      </div>
    </div>
  );
}

interface CameraDeniedOverlayProps {
  onBack: () => void;
}

export function CameraDeniedOverlay({ onBack }: CameraDeniedOverlayProps) {
  return (
    <div className="absolute inset-0 bg-zinc-950 z-40 flex flex-col items-center justify-center text-center p-6">
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
                : status === "camera-denied"
                  ? "bg-red-500"
                  : "bg-blue-500 animate-pulse"
          }`}
        />
        {status === "loading" && "Preparing…"}
        {status === "camera-denied" && "Camera required"}
        {status === "scanning" && "Scanning…"}
        {status === "found" && "Object found!"}
      </div>
    </div>
  );
}
