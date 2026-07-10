"use client";

import { useState, useEffect } from "react";
import { isOnline, onOnlineStatusChange } from "@/lib/offline";

export function useOffline() {
  const [offline, setOffline] = useState(!isOnline());

  useEffect(() => {
    const unsubscribe = onOnlineStatusChange((online) => setOffline(!online));
    return unsubscribe;
  }, []);

  return offline;
}
