export interface StoredBulkFile {
  fileId: string;
  sessionId: string;
  fileName: string;
  mimeType: string;
  size: number;
  blob: Blob;
  displayName: string;
  timestamp: number;
}

const DB_NAME = 'DropLinkBulkDB';
const DB_VERSION = 1;
const STORE_NAME = 'bulk_files';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'fileId' });
        store.createIndex('sessionId', 'sessionId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveBulkFileBlob(item: Omit<StoredBulkFile, 'timestamp'>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record: StoredBulkFile = {
      ...item,
      timestamp: Date.now(),
    };

    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getBulkFileBlob(fileId: string): Promise<StoredBulkFile | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(fileId);

    request.onsuccess = () => resolve((request.result as StoredBulkFile) || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllBulkFiles(sessionId: string): Promise<StoredBulkFile[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('sessionId');
    const request = index.getAll(sessionId);

    request.onsuccess = () => resolve((request.result as StoredBulkFile[]) || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteBulkFileBlob(fileId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(fileId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearSessionBlobs(sessionId: string): Promise<void> {
  const files = await getAllBulkFiles(sessionId);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    files.forEach((file) => store.delete(file.fileId));

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
