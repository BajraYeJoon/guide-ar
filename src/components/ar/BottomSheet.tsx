"use client";

import React from "react";
import { TargetInfo } from "@/data/targets";
import { Sparkles, ChevronRight } from "lucide-react";

interface LockSheetProps {
  foundTarget: TargetInfo | null;
  onViewDetails: () => void;
}

export function LockSheet({ foundTarget, onViewDetails }: LockSheetProps) {
  if (!foundTarget) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 p-4 pb-6 animate-slideUp">
      <button
        onClick={onViewDetails}
        className="w-full bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-2xl p-4 flex items-center gap-4 shadow-[0_-4px_30px_rgba(0,0,0,0.5)] active:scale-[0.98] transition-transform"
      >
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-6 h-6 text-amber-500" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-xs text-amber-500 font-bold uppercase tracking-wider">
            Object Identified
          </div>
          <div className="text-base font-extrabold text-white mt-0.5">
            {foundTarget.name}
          </div>
          <div className="text-xs text-zinc-400 mt-0.5">
            Tap to view full details
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-zinc-500 flex-shrink-0" />
      </button>
    </div>
  );
}
