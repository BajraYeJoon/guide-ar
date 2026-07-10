"use client";

import React from "react";
import { TARGETS } from "@/data/targets";
import { ArrowLeft, MapPin } from "lucide-react";

interface TargetDetailPageProps {
  targetId: string;
  onBack: () => void;
}

export function TargetDetailPage({ targetId, onBack }: TargetDetailPageProps) {
  const target = TARGETS.find((t) => t.id === targetId);

  if (!target) {
    return (
      <div className="fixed inset-0 bg-zinc-950 text-zinc-100 flex items-center justify-center z-50">
        <div className="text-center">
          <h1 className="text-xl font-bold text-white mb-2">Not Found</h1>
          <p className="text-sm text-zinc-400 mb-4">Object not recognized.</p>
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-zinc-950 text-zinc-100 font-sans z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-300" />
          </button>
          <h1 className="text-lg font-bold text-white truncate">{target.name}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Image */}
        <div className="rounded-2xl overflow-hidden border border-zinc-800">
          <img
            src={target.referenceImage}
            alt={target.name}
            className="w-full aspect-video object-cover"
          />
        </div>

        {/* Name & Description */}
        <div>
          <h2 className="text-2xl font-extrabold text-white mb-2">
            {target.name}
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {target.description}
          </p>
        </div>

        {/* Specs */}
        <div>
          <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-3">
            Specifications
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {target.specs.map((spec, i) => (
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

        {/* History */}
        <div>
          <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-3">
            History & Background
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {target.history}
          </p>
        </div>

        {/* Back button */}
        <button
          onClick={onBack}
          className="w-full py-3 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 transition-colors flex items-center justify-center gap-2"
        >
          <MapPin className="w-4 h-4" />
          Back to Live AR
        </button>
      </div>
    </div>
  );
}
