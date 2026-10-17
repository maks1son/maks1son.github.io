const db = new Promise((resolve, reject) => {
  const request = indexedDB.open('rosocenka-local', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('cases', { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
export async function allCases() {
  const database = await db;
  return new Promise((resolve, reject) => { const req = database.transaction('cases').objectStore('cases').getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}
export async function saveCase(record) {
  const database = await db;
  return new Promise((resolve, reject) => { const tx = database.transaction('cases', 'readwrite'); tx.objectStore('cases').put(structuredClone(record)); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
}
