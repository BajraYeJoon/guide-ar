"use client";

import { useState, useEffect } from "react";
import { getAllObjects, type StoredObject } from "@/lib/db";
import { TARGETS, type TargetInfo } from "@/data/targets";

function storedToTarget(obj: StoredObject): TargetInfo {
  const specs = Object.entries(obj.specs).map(([label, value]) => ({ label, value }));
  const hardcoded = TARGETS.find((t) => t.id === obj.id);
  return {
    id: obj.id,
    name: obj.name,
    description: obj.description,
    specs,
    history: obj.history,
    referenceImage: obj.imageUrl,
    mindFile: hardcoded?.mindFile ?? "",
  };
}

export function useObjects() {
  const [objects, setObjects] = useState<TargetInfo[]>(TARGETS);

  useEffect(() => {
    getAllObjects()
      .then((stored) => {
        if (stored.length > 0) {
          setObjects(stored.map(storedToTarget));
        }
      })
      .catch(() => {});
  }, []);

  return objects;
}
