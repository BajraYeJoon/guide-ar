"use client";

import React, { useState } from "react";
import { TARGETS } from "@/data/targets";
import { InfoView } from "@/components/ar/InfoView";
import { ARView } from "@/components/ar/ARView";

export default function ARPage() {
  const [viewMode, setViewMode] = useState<"info" | "ar">("info");
  const [selectedTarget, setSelectedTarget] = useState(TARGETS[0]);

  return (
    <>
      {viewMode === "info" && (
        <InfoView
          selectedTarget={selectedTarget!}
          onSelectTarget={setSelectedTarget}
          onStartAR={() => setViewMode("ar")}
        />
      )}

      {viewMode === "ar" && (
        <ARView onBack={() => setViewMode("info")} />
      )}
    </>
  );
}
