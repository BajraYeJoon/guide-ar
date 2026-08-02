"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useTargets } from "@/hooks/useTargets";
import { TargetDetail } from "@/components/ar/TargetDetail";

// Standalone deep-link / shareable detail route. Reads from the same
// offline-first target cache as the rest of the app. The primary in-app path
// renders TargetDetail as an overlay inside /ar (no navigation), but this route
// keeps direct links to /ar/<id> working.
export default function TargetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { targets, status } = useTargets();
  const target = targets.find((t) => t._id === params.id);

  if (!target) {
    // Still loading the cache — avoid a premature "not found" flash.
    if (status === "loading") {
      return (
        <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
          <p className="text-sm text-zinc-400">Loading…</p>
        </div>
      );
    }
    return (
      <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold text-white mb-2">Not Found</h1>
          <p className="text-sm text-zinc-400 mb-4">Object not recognized.</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <TargetDetail
      target={target}
      onBack={() => router.push("/ar")}
      backLabel="Back to Live AR"
    />
  );
}
