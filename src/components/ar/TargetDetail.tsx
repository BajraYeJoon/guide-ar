"use client";

import React, { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import type { TargetInfo } from "@/lib/types";
import { sanitizeHtml } from "@/lib/sanitize";

interface TargetDetailProps {
  target: TargetInfo;
  onBack: () => void;
  /** Label for the back button, e.g. "Back to Live AR" or "Back". */
  backLabel?: string;
}

/**
 * Rich detail view for a target. Renders the admin-authored HTML `content`
 * when present, otherwise falls back to the legacy description/specs/history
 * fields so pre-existing targets still display correctly.
 *
 * Used both as an in-place overlay inside the AR view and as the standalone
 * /ar/[id] deep-link page, so it stays presentation-only (no data fetching).
 */
export function TargetDetail({
  target,
  onBack,
  backLabel = "Back",
}: TargetDetailProps) {
  const html = useMemo(
    () => (target.content ? sanitizeHtml(target.content) : ""),
    [target.content]
  );

  const hasLegacySpecs = !target.content && (target.specs?.length ?? 0) > 0;
  const hasLegacyHistory = !target.content && !!target.history;

  return (
    <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
            aria-label={backLabel}
          >
            <ArrowLeft className="w-5 h-5 text-zinc-300" />
          </button>
          <h1 className="text-lg font-bold text-white truncate">
            {target.name}
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Hero image */}
        <div className="rounded-2xl overflow-hidden border border-zinc-800">
          {target.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- offline blob URLs
            <img
              src={target.imageUrl}
              alt={target.name}
              className="w-full aspect-video object-cover"
            />
          ) : (
            <div className="w-full aspect-video bg-zinc-800 flex items-center justify-center">
              <span className="text-sm text-zinc-500">No image</span>
            </div>
          )}
        </div>

        {/* Title & short description */}
        <div>
          <h2 className="text-2xl font-extrabold text-white mb-2">
            {target.name}
          </h2>
          {target.description && (
            <p className="text-sm text-zinc-400 leading-relaxed">
              {target.description}
            </p>
          )}
        </div>

        {/* Rich blog content */}
        {html && (
          <div
            className="prose-guide"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}

        {/* Legacy fallbacks (only when no rich content exists) */}
        {hasLegacySpecs && (
          <div>
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-3">
              Specifications
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {target.specs!.map((spec, i) => (
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
        )}

        {hasLegacyHistory && (
          <div>
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-3">
              History &amp; Background
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {target.history}
            </p>
          </div>
        )}

        {/* Back button */}
        <button
          onClick={onBack}
          className="w-full py-3 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </button>
      </div>
    </div>
  );
}
