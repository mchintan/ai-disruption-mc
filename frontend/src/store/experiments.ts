import type { PortfolioExperiment } from "../types/portfolio";

const DB_NAME = "portfolio_mc";
const DB_VERSION = 1;
const STORE_NAME = "experiments";
const ACTIVE_KEY = "active_experiment_id";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveExperiment(exp: PortfolioExperiment): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ ...exp, updatedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getExperiment(id: string): Promise<PortfolioExperiment | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function listExperiments(): Promise<PortfolioExperiment[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const results = req.result as PortfolioExperiment[];
      results.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteExperiment(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function setActiveExperimentId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function getActiveExperimentId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}
