"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useObjects } from "@/hooks/useObjects";
import { InfoView } from "@/components/ar/InfoView";

export default function HomePage() {
  const router = useRouter();
  const objects = useObjects();
  const [selectedTarget, setSelectedTarget] = useState(objects[0]);

  return (
    <InfoView
      targets={objects}
      selectedTarget={selectedTarget}
      onSelectTarget={setSelectedTarget}
      onStartAR={() => router.push("/ar")}
    />
  );
}
