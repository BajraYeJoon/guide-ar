"use client";

import { useEffect } from "react";
import { getAllObjects, putObject } from "@/lib/db";
import { startAutoSync, syncAllData } from "@/lib/sync";
import { TARGETS } from "@/data/targets";

export function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    getAllObjects().then((stored) => {
      if (stored.length === 0) {
        TARGETS.forEach((t) => {
          putObject({
            id: t.id,
            name: t.name,
            description: t.description,
            history: t.history,
            specs: Object.fromEntries(t.specs.map((s) => [s.label, s.value])),
            imageUrl: t.referenceImage,
            lastUpdated: Date.now(),
          });
        });
      }
    });
    syncAllData();
    const stopSync = startAutoSync();
    return stopSync;
  }, []);

  return <>{children}</>;
}
