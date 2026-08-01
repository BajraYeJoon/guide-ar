"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useTargets } from "@/hooks/useTargets";
import { InfoView } from "@/components/ar/InfoView";
import type { TargetInfo } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const { targets, status, syncing, lastSyncedAt, refresh } = useTargets();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Derive the active target instead of syncing state from props in an effect:
  // falls back to the first target (or nothing) whenever targets change.
  const selectedTarget: TargetInfo | null = targets.length
    ? (targets.find((t) => t._id === selectedId) ?? targets[0])
    : null;

  if (!selectedTarget) {
    return (
      <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    );
  }

  return (
    <InfoView
      targets={targets}
      selectedTarget={selectedTarget}
      onSelectTarget={(target) => setSelectedId(target._id)}
      onStartAR={() => router.push("/ar")}
      status={status}
      syncing={syncing}
      lastSyncedAt={lastSyncedAt}
      onRefresh={refresh}
    />
  );
}
