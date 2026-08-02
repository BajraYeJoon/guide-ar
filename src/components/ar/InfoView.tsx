"use client";

import React, { useMemo } from "react";
import { Radio, RefreshCw } from "lucide-react";
import type { TargetInfo } from "@/lib/types";
import type { SyncStatus } from "@/hooks/useTargets";
import { sanitizeHtml } from "@/lib/sanitize";

interface InfoViewProps {
  targets: TargetInfo[];
  selectedTarget: TargetInfo;
  onSelectTarget: (target: TargetInfo) => void;
  onStartAR: () => void;
  status: SyncStatus;
  syncing: boolean;
  lastSyncedAt: number | null;
  onRefresh: () => void;
}

function SyncBadge({
  status,
  syncing,
  lastSyncedAt,
  onRefresh,
}: {
  status: SyncStatus;
  syncing: boolean;
  lastSyncedAt: number | null;
  onRefresh: () => void;
}) {
  const online = status === "online";
  return (
    <button
      onClick={onRefresh}
      disabled={syncing}
      title="Tap to re-sync from Convex"
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        online
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
          : "bg-zinc-800 border-zinc-700 text-zinc-400"
      } ${syncing ? "opacity-60" : ""}`}
    >
      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
      {syncing
        ? "Syncing…"
        : online
          ? "Online"
          : status === "loading"
            ? "Loading…"
            : "Offline"}
      {lastSyncedAt ? (
        <span className="opacity-70">
          · {new Date(lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      ) : null}
    </button>
  );
}

export function InfoView({
  targets,
  selectedTarget,
  onSelectTarget,
  onStartAR,
  status,
  syncing,
  lastSyncedAt,
  onRefresh,
}: InfoViewProps) {
  return (
    <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-white">Temple Guide</h1>
          <div className="flex items-center gap-2">
            <SyncBadge
              status={status}
              syncing={syncing}
              lastSyncedAt={lastSyncedAt}
              onRefresh={onRefresh}
            />
            <button
              onClick={onStartAR}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 transition-all"
            >
              <Radio className="w-4 h-4" />
              Live AR
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Target selector */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {targets.map((target) => (
            <button
              key={target._id}
              onClick={() => onSelectTarget(target)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedTarget._id === target._id
                  ? "bg-amber-500 text-zinc-950"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {target.name}
            </button>
          ))}
        </div>

        {/* Main info card */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="aspect-video bg-zinc-800 flex items-center justify-center">
            {selectedTarget.imageUrl ? (
              <img
                src={selectedTarget.imageUrl}
                alt={selectedTarget.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm text-zinc-500">No image</span>
            )}
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

        {/* Rich content (with legacy history/specs fallback) */}
        <TargetBody target={selectedTarget} />

        {/* Instructions */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-amber-500 mb-2">
            How to use Live AR
          </h3>
          <ol className="text-sm text-zinc-400 space-y-2 list-decimal list-inside">
            <li>Tap &quot;Live AR&quot; to activate camera</li>
            <li>Point your camera at the object</li>
            <li>Watch for the amber marker to appear</li>
            <li>Swipe up the info sheet for details</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// Renders a target's rich HTML content, falling back to the legacy
// history/specs fields for targets authored before the rich editor.
function TargetBody({ target }: { target: TargetInfo }) {
  const html = useMemo(
    () => (target.content ? sanitizeHtml(target.content) : ""),
    [target.content]
  );

  if (html) {
    return (
      <div className="prose-guide" dangerouslySetInnerHTML={{ __html: html }} />
    );
  }

  const specs = target.specs ?? [];
  return (
    <>
      {specs.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-3">
            Specifications
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {specs.map((spec, i) => (
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
      {target.history && (
        <div>
          <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-3">
            History
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {target.history}
          </p>
        </div>
      )}
    </>
  );
}
