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

  const previewSpecs = foundTarget.specs.slice(0, 3);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 p-4 pb-6 animate-slideUp">
      <button
        onClick={onViewDetails}
        className="w-full bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-2xl overflow-hidden shadow-[0_-4px_30px_rgba(0,0,0,0.5)] active:scale-[0.98] transition-transform text-left"
      >
        {/* Header */}
        <div className="p-4 pb-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">
              Object Identified
            </div>
            <div className="text-base font-extrabold text-white truncate">
              {foundTarget.name}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-500 flex-shrink-0" />
        </div>

        {/* Preview specs */}
        {previewSpecs.length > 0 && (
          <div className="px-4 pb-4 flex gap-2">
            {previewSpecs.map((spec, i) => (
              <div
                key={i}
                className="flex-1 p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50"
              >
                <div className="text-[8px] text-zinc-500 uppercase font-medium">
                  {spec.label}
                </div>
                <div className="text-[10px] font-bold text-zinc-200 mt-0.5 truncate">
                  {spec.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="px-4 py-2.5 bg-zinc-800/40 border-t border-zinc-700/50 text-center">
          <span className="text-xs font-semibold text-amber-500">
            Tap to view full details
          </span>
        </div>
      </button>
    </div>
  );
}
