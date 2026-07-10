import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "webar-temple-guide";
const DB_VERSION = 1;

export interface StoredObject {
  id: string;
  name: string;
  description: string;
  history: string;
  specs: Record<string, string>;
  imageUrl: string;
  audioUrl?: string;
  lastUpdated: number;
}

export interface StoredScene {
  id: string;
  name: string;
  description: string;
  objects: string[];
  lastUpdated: number;
}

export interface StoredCategory {
  id: string;
  name: string;
  description: string;
  scenes: string[];
  lastUpdated: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("objects")) {
          db.createObjectStore("objects", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("scenes")) {
          db.createObjectStore("scenes", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("categories")) {
          db.createObjectStore("categories", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("ai-models")) {
          db.createObjectStore("ai-models", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

// Objects
export async function getObject(id: string): Promise<StoredObject | undefined> {
  const db = await getDB();
  return db.get("objects", id);
}

export async function getAllObjects(): Promise<StoredObject[]> {
  const db = await getDB();
  return db.getAll("objects");
}

export async function putObject(obj: StoredObject): Promise<void> {
  const db = await getDB();
  await db.put("objects", { ...obj, lastUpdated: Date.now() });
}

export async function deleteObject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("objects", id);
}

// Scenes
export async function getScene(id: string): Promise<StoredScene | undefined> {
  const db = await getDB();
  return db.get("scenes", id);
}

export async function getAllScenes(): Promise<StoredScene[]> {
  const db = await getDB();
  return db.getAll("scenes");
}

export async function putScene(scene: StoredScene): Promise<void> {
  const db = await getDB();
  await db.put("scenes", { ...scene, lastUpdated: Date.now() });
}

// Categories
export async function getCategory(id: string): Promise<StoredCategory | undefined> {
  const db = await getDB();
  return db.get("categories", id);
}

export async function getAllCategories(): Promise<StoredCategory[]> {
  const db = await getDB();
  return db.getAll("categories");
}

export async function putCategory(category: StoredCategory): Promise<void> {
  const db = await getDB();
  await db.put("categories", { ...category, lastUpdated: Date.now() });
}

// AI Models
export interface StoredAIModel {
  id: string;
  name: string;
  data: ArrayBuffer;
  lastUpdated: number;
}

export async function getAIModel(id: string): Promise<StoredAIModel | undefined> {
  const db = await getDB();
  return db.get("ai-models", id);
}

export async function putAIModel(model: StoredAIModel): Promise<void> {
  const db = await getDB();
  await db.put("ai-models", { ...model, lastUpdated: Date.now() });
}

// Sync helpers
export async function syncObjects(objects: StoredObject[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("objects", "readwrite");
  await Promise.all([
    ...objects.map((obj) => tx.store.put({ ...obj, lastUpdated: Date.now() })),
    tx.done,
  ]);
}

export async function syncScenes(scenes: StoredScene[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("scenes", "readwrite");
  await Promise.all([
    ...scenes.map((scene) => tx.store.put({ ...scene, lastUpdated: Date.now() })),
    tx.done,
  ]);
}

export async function syncCategories(categories: StoredCategory[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("categories", "readwrite");
  await Promise.all([
    ...categories.map((cat) => tx.store.put({ ...cat, lastUpdated: Date.now() })),
    tx.done,
  ]);
}