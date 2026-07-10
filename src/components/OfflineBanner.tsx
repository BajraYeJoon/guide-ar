"use client";

import { useOffline } from "@/hooks/useOffline";

export function OfflineBanner() {
  const offline = useOffline();

  if (!offline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center py-2 text-sm font-medium">
      You&apos;re offline — some features may be limited
    </div>
  );
}
