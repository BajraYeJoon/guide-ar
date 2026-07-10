"use client";

import { useEffect } from "react";
import { startAutoSync } from "@/lib/sync";

export function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stopSync = startAutoSync();
    return stopSync;
  }, []);

  return <>{children}</>;
}
