"use client";

import React from "react";

export function ScanOverlay() {
  return (
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
  );
}
