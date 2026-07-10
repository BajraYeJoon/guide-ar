"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ARView } from "@/components/ar/ARView";

export default function ARPage() {
  const router = useRouter();

  return (
    <ARView
      onBack={() => router.push("/")}
      onViewDetails={(id) => router.push(`/ar/${id}`)}
    />
  );
}
