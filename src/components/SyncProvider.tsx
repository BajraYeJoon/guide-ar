"use client";

import { useEffect } from "react";
import { startAutoSync } from "@/lib/sync";

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  }
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerSW();
    const stopSync = startAutoSync();
    return stopSync;
  }, []);

  return <>{children}</>;
}
