"use client";

import React, { useState, useCallback } from "react";
import { TARGETS } from "@/data/targets";
import { InfoView } from "@/components/ar/InfoView";
import { ARView } from "@/components/ar/ARView";
import { TargetDetailPage } from "@/components/ar/TargetDetail";

type ViewMode = "info" | "ar" | "detail";

export default function ARPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("info");
  const [selectedTarget, setSelectedTarget] = useState(TARGETS[0]);
  const [detailTargetId, setDetailTargetId] = useState<string | null>(null);
  const [resumeCount, setResumeCount] = useState(0);

  const handleStartAR = () => setViewMode("ar");
  const handleBackToInfo = () => setViewMode("info");

  const handleViewDetails = (targetId: string) => {
    setDetailTargetId(targetId);
    setViewMode("detail");
  };

  const handleBackToAR = () => {
    setDetailTargetId(null);
    setViewMode("ar");
    setResumeCount((c) => c + 1);
  };

  return (
    <>
      {viewMode === "info" && (
        <InfoView
          selectedTarget={selectedTarget}
          onSelectTarget={setSelectedTarget}
          onStartAR={handleStartAR}
        />
      )}

      {/* AR view - stays mounted when showing detail */}
      {(viewMode === "ar" || viewMode === "detail") && (
        <div className={viewMode === "detail" ? "hidden" : ""}>
          <ARView
            onBack={handleBackToInfo}
            onViewDetails={handleViewDetails}
            resumeKey={resumeCount}
          />
        </div>
      )}

      {viewMode === "detail" && detailTargetId && (
        <TargetDetailPage
          targetId={detailTargetId}
          onBack={handleBackToAR}
        />
      )}
    </>
  );
}
