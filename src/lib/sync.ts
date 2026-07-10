import { syncObjects, syncScenes, syncCategories } from "./db";
import type { StoredObject, StoredScene, StoredCategory } from "./db";
import { isOnline } from "./offline";

const API_BASE = "/api";

export async function syncAllData(): Promise<void> {
  if (!isOnline()) {
    return;
  }

  try {
    const objectsResponse = await fetch(`${API_BASE}/objects`);
    if (objectsResponse.ok) {
      const objects: StoredObject[] = await objectsResponse.json();
      await syncObjects(objects);
    }

    const scenesResponse = await fetch(`${API_BASE}/scenes`);
    if (scenesResponse.ok) {
      const scenes: StoredScene[] = await scenesResponse.json();
      await syncScenes(scenes);
    }

    const categoriesResponse = await fetch(`${API_BASE}/categories`);
    if (categoriesResponse.ok) {
      const categories: StoredCategory[] = await categoriesResponse.json();
      await syncCategories(categories);
    }
  } catch (error) {
    console.error("Data sync failed:", error);
  }
}

export function startAutoSync(intervalMs: number = 5 * 60 * 1000): () => void {
  syncAllData();
  const interval = setInterval(syncAllData, intervalMs);
  return () => clearInterval(interval);
}
