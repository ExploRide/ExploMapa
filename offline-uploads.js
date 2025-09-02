(function(){
  const DB_NAME = 'offlineUploads';
  const STORE = 'files';
  let dbPromise = null;

  function openDB(){
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function withStore(mode, cb){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const result = cb(store);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getCount(){
    return withStore('readonly', store => store.count());
  }

  async function queuePhotoUpload({ file, pinId, path }){
    const id = Date.now() + '-' + Math.random().toString(36).slice(2);
    await withStore('readwrite', store => {
      store.put({ id, pinId, path, name: file.name, type: file.type, blob: file, addedAt: Date.now() });
    });
    const count = await getCount();
    if (window.renderSyncQueueCount) window.renderSyncQueueCount(count);
  }

  async function getAll(){
    return withStore('readonly', store => store.getAll());
  }

  async function remove(id){
    return withStore('readwrite', store => store.delete(id));
  }

  async function flushQueuedUploads({ onProgress } = {}){
    const items = await getAll();
    let done = 0;
    for (const item of items){
      try {
        const refPath = item.path || `pins/${item.pinId}/${item.name}`;
        const storageRef = firebase.storage().ref().child(refPath);
        await storageRef.put(item.blob);
        await remove(item.id);
        done++;
        if (onProgress) onProgress(done, items.length);
      } catch (err){
        console.error('flush upload error', err);
        throw err;
      }
    }
    const count = await getCount();
    if (window.renderSyncQueueCount) window.renderSyncQueueCount(count);
    return done;
  }

  window.queuePhotoUpload = queuePhotoUpload;
  window.flushQueuedUploads = flushQueuedUploads;

  window.addEventListener('online', () => {
    flushQueuedUploads({}).catch(()=>{});
  });

  openDB().then(async () => {
    const count = await getCount();
    if (window.renderSyncQueueCount) window.renderSyncQueueCount(count);
  });
})();
