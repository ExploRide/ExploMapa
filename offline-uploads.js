(function(){
  const DB_NAME = 'offlineUploads';
  const DB_VERSION = 2;
  const FILES_STORE = 'files';
  const QUEUE_STORE = 'offlineQueue';
  let dbPromise = null;

  function genId(prefix='local') { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }

  function emitQueueChanged() {
    window.dispatchEvent(new CustomEvent('offline-queue-changed'));
  }

  function openDB(){
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(FILES_STORE)) db.createObjectStore(FILES_STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          const q = db.createObjectStore(QUEUE_STORE, { keyPath: 'localId' });
          q.createIndex('syncStatus', 'syncStatus', { unique: false });
          q.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function withStore(storeName, mode, cb){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const req = cb(store);
      tx.oncomplete = async () => {
        if (req && typeof req.result !== 'undefined') resolve(req.result);
        else resolve(undefined);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getUploadCount(){ return withStore(FILES_STORE, 'readonly', s => s.count()); }
  async function getQueueItems(){ return withStore(QUEUE_STORE, 'readonly', s => s.getAll()); }

  async function queuePhotoUpload({ file, pinId, path }){
    const id = genId('upload');
    await withStore(FILES_STORE, 'readwrite', store => store.put({ id, pinId, path, name: file.name, type: file.type, blob: file, addedAt: Date.now() }));
    await refreshSyncUi();
  }

  async function removeUpload(id){ return withStore(FILES_STORE, 'readwrite', s => s.delete(id)); }

  async function flushQueuedUploads(){
    const items = await withStore(FILES_STORE, 'readonly', s => s.getAll());
    let done = 0;
    for (const item of items){
      const refPath = item.path || `pins/${item.pinId}/${item.name}`;
      const storageRef = firebase.storage().ref().child(refPath);
      await storageRef.put(item.blob);
      await removeUpload(item.id);
      done++;
    }
    return done;
  }

  async function upsertQueueOperation(operationData){
    const now = Date.now();
    const op = {
      localId: operationData.localId || genId('pin'),
      operation: operationData.operation,
      firebaseId: operationData.firebaseId || null,
      payload: operationData.payload || {},
      createdAt: operationData.createdAt || now,
      updatedAt: now,
      syncStatus: operationData.syncStatus || 'pending',
      errorMessage: operationData.errorMessage || ''
    };
    await withStore(QUEUE_STORE, 'readwrite', s => s.put(op));
    emitQueueChanged();
    await refreshSyncUi();
    return op;
  }

  async function updateQueueOperation(localId, patch){
    const current = await withStore(QUEUE_STORE, 'readonly', s => s.get(localId));
    if (!current) return null;
    const next = { ...current, ...patch, updatedAt: Date.now() };
    await withStore(QUEUE_STORE, 'readwrite', s => s.put(next));
    emitQueueChanged();
    await refreshSyncUi();
    return next;
  }

  async function deleteQueueOperation(localId){
    await withStore(QUEUE_STORE, 'readwrite', s => s.delete(localId));
    emitQueueChanged();
    await refreshSyncUi();
  }

  async function getPendingLikeOperations(){
    const all = await getQueueItems();
    return all.filter(op => op.syncStatus === 'pending' || op.syncStatus === 'error').sort((a,b)=>a.createdAt-b.createdAt);
  }

  async function syncOfflineQueue(){
    if (!navigator.onLine) {
      if (window.updateSyncStatus) window.updateSyncStatus('offline');
      return { synced: 0, failed: 0 };
    }
    if (window.updateSyncStatus) window.updateSyncStatus('synchronizuję');

    const ops = await getPendingLikeOperations();
    let synced = 0;
    let failed = 0;

    for (const op of ops) {
      try {
        await updateQueueOperation(op.localId, { syncStatus: 'syncing', errorMessage: '' });
        if (op.operation === 'createPin') {
          const payload = { ...op.payload };
          delete payload.activeTripDay;
          const ref = await window.db.collection('pinezki2').add(payload);
          await updateQueueOperation(op.localId, { syncStatus: 'synced', firebaseId: ref.id, errorMessage: '' });
          await deleteQueueOperation(op.localId);
        } else if (op.operation === 'updatePin' && op.firebaseId) {
          const payload = { ...op.payload };
          delete payload.activeTripDay;
          await window.db.collection('pinezki2').doc(op.firebaseId).set(payload, { merge: true });
          await updateQueueOperation(op.localId, { syncStatus: 'synced', errorMessage: '' });
        } else if (op.operation === 'deletePin' && op.firebaseId) {
          await window.db.collection('pinezki2').doc(op.firebaseId).delete();
          await updateQueueOperation(op.localId, { syncStatus: 'synced', errorMessage: '' });
          await deleteQueueOperation(op.localId);
        }
        synced++;
      } catch (error) {
        failed++;
        await updateQueueOperation(op.localId, { syncStatus: 'error', errorMessage: error?.message || 'Nieznany błąd synchronizacji' });
      }
    }

    try { await flushQueuedUploads(); } catch (_e) {}

    if (window.updateSyncStatus) window.updateSyncStatus(failed ? 'błąd synchronizacji' : 'zsynchronizowano');
    return { synced, failed };
  }

  async function refreshSyncUi(){
    const [uploads, queueItems] = await Promise.all([getUploadCount(), getQueueItems()]);
    const unsyncedPins = queueItems.filter(i => i.syncStatus !== 'synced');
    const count = uploads + unsyncedPins.length;
    if (window.renderSyncQueueCount) window.renderSyncQueueCount(count);
    if (window.renderOfflinePinsList) window.renderOfflinePinsList(unsyncedPins);
  }

  window.queuePhotoUpload = queuePhotoUpload;
  window.flushQueuedUploads = flushQueuedUploads;
  window.syncOfflineQueue = syncOfflineQueue;
  window.upsertQueueOperation = upsertQueueOperation;
  window.updateQueueOperation = updateQueueOperation;
  window.deleteQueueOperation = deleteQueueOperation;

  window.addEventListener('online', () => { syncOfflineQueue().catch(()=>{}); });

  openDB().then(() => refreshSyncUi());
})();
