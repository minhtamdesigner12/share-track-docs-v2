// Guest (no-login) PDF workflow storage.
//
// This used to be a plain in-memory Map, which meant the uploaded file was
// wiped out by *any* full-page navigation — including the round trip through
// Google's OAuth consent screen when a guest clicks "Share". That made the
// share flow look like it silently deleted the user's file. IndexedDB
// persists across that redirect (same origin, same tab), so we use it here
// instead. Object URLs are still created fresh per read since blob: URLs
// don't survive navigations either way.

const DB_NAME = "guest-pdf-store";
const STORE = "pdfs";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // prune anything older than a day

interface GuestPdf {
  id: string;
  name: string;
  url: string;
  bytes: Uint8Array;
}

interface StoredRecord {
  id: string;
  name: string;
  bytes: Uint8Array;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;
// Object URLs handed out this session, so we can revoke them on clear.
const urlCache = new Map<string, string>();

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function pruneOld(db: IDBDatabase) {
  const cutoff = Date.now() - MAX_AGE_MS;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      const rec = cursor.value as StoredRecord;
      if (rec.createdAt < cutoff) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

function toEntry(rec: StoredRecord): GuestPdf {
  let url = urlCache.get(rec.id);
  if (!url) {
    url = URL.createObjectURL(new Blob([rec.bytes as BlobPart], { type: "application/pdf" }));
    urlCache.set(rec.id, url);
  }
  return { id: rec.id, name: rec.name, url, bytes: rec.bytes };
}

export async function putGuestPdf(file: File): Promise<GuestPdf> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const name = file.name.replace(/\.pdf$/i, "");
  return putGuestPdfBytes(bytes, name);
}

export async function putGuestPdfBytes(bytes: Uint8Array, name: string): Promise<GuestPdf> {
  const id = crypto.randomUUID();
  const rec: StoredRecord = {
    id,
    name: name.replace(/\.pdf$/i, ""),
    bytes,
    createdAt: Date.now(),
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  pruneOld(db).catch(() => {});
  return toEntry(rec);
}

export async function getGuestPdf(id: string): Promise<GuestPdf | undefined> {
  const db = await openDb();
  const rec = await new Promise<StoredRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as StoredRecord | undefined);
    req.onerror = () => reject(req.error);
  });
  return rec ? toEntry(rec) : undefined;
}

export async function clearGuestPdf(id: string): Promise<void> {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* IndexedDB unavailable (e.g. SSR) — nothing to clean up */
  }
}
