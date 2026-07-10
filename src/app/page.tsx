"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { TARGETS } from "@/data/targets";
import { InfoView } from "@/components/ar/InfoView";

export default function HomePage() {
  const router = useRouter();
  const [selectedTarget, setSelectedTarget] = useState(TARGETS[0]);

  return (
    <InfoView
      selectedTarget={selectedTarget}
      onSelectTarget={setSelectedTarget}
      onStartAR={() => router.push("/ar")}
    />
  );
}
