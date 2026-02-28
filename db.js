// ========================================================
//  db.js — IndexedDB Manager for Creator CMS
//  Stores: songs, images, videos, articles
// ========================================================

const DB_NAME = 'CreatorCMS';
const DB_VERSION = 1;

let db = null;

const STORES = {
  songs: 'songs',
  images: 'images',
  videos: 'videos',
  articles: 'articles',
};

// ── Open / Init ──────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const d = e.target.result;

      if (!d.objectStoreNames.contains(STORES.songs)) {
        const songs = d.createObjectStore(STORES.songs, { keyPath: 'id', autoIncrement: true });
        songs.createIndex('genre', 'genre', { unique: false });
        songs.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      }

      if (!d.objectStoreNames.contains(STORES.images)) {
        const images = d.createObjectStore(STORES.images, { keyPath: 'id', autoIncrement: true });
        images.createIndex('category', 'category', { unique: false });
      }

      if (!d.objectStoreNames.contains(STORES.videos)) {
        const videos = d.createObjectStore(STORES.videos, { keyPath: 'id', autoIncrement: true });
        videos.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      }

      if (!d.objectStoreNames.contains(STORES.articles)) {
        const articles = d.createObjectStore(STORES.articles, { keyPath: 'id', autoIncrement: true });
        articles.createIndex('date', 'date', { unique: false });
      }
    };

    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

// ── Generic Helpers ──────────────────────────────────────
function txStore(storeName, mode = 'readonly') {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function promisify(req) {
  return new Promise((res, rej) => {
    req.onsuccess = (e) => res(e.target.result);
    req.onerror = (e) => rej(e.target.error);
  });
}

// ── CRUD ─────────────────────────────────────────────────
async function addItem(storeName, data) {
  await openDB();
  data.createdAt = Date.now();
  return promisify(txStore(storeName, 'readwrite').add(data));
}

async function updateItem(storeName, data) {
  await openDB();
  data.updatedAt = Date.now();
  return promisify(txStore(storeName, 'readwrite').put(data));
}

async function deleteItem(storeName, id) {
  await openDB();
  return promisify(txStore(storeName, 'readwrite').delete(id));
}

async function getItem(storeName, id) {
  await openDB();
  return promisify(txStore(storeName).get(id));
}

async function getAllItems(storeName) {
  await openDB();
  return promisify(txStore(storeName).getAll());
}

// ── Songs ─────────────────────────────────────────────────
const Songs = {
  add: (data) => addItem(STORES.songs, data),
  update: (data) => updateItem(STORES.songs, data),
  delete: (id) => deleteItem(STORES.songs, id),
  get: (id) => getItem(STORES.songs, id),
  getAll: () => getAllItems(STORES.songs),
  search: async (query) => {
    const all = await getAllItems(STORES.songs);
    const q = query.toLowerCase();
    return all.filter(s =>
      s.title?.toLowerCase().includes(q) ||
      s.artist?.toLowerCase().includes(q) ||
      s.genre?.toLowerCase().includes(q) ||
      s.lyrics?.toLowerCase().includes(q)
    );
  }
};

// ── Images ────────────────────────────────────────────────
const Images = {
  add: (data) => addItem(STORES.images, data),
  update: (data) => updateItem(STORES.images, data),
  delete: (id) => deleteItem(STORES.images, id),
  get: (id) => getItem(STORES.images, id),
  getAll: () => getAllItems(STORES.images),
  search: async (query) => {
    const all = await getAllItems(STORES.images);
    const q = query.toLowerCase();
    return all.filter(i =>
      i.title?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q)
    );
  }
};

// ── Videos ────────────────────────────────────────────────
const Videos = {
  add: (data) => addItem(STORES.videos, data),
  update: (data) => updateItem(STORES.videos, data),
  delete: (id) => deleteItem(STORES.videos, id),
  get: (id) => getItem(STORES.videos, id),
  getAll: () => getAllItems(STORES.videos),
  search: async (query) => {
    const all = await getAllItems(STORES.videos);
    const q = query.toLowerCase();
    return all.filter(v =>
      v.title?.toLowerCase().includes(q) ||
      v.description?.toLowerCase().includes(q)
    );
  }
};

// ── Articles ──────────────────────────────────────────────
const Articles = {
  add: (data) => addItem(STORES.articles, data),
  update: (data) => updateItem(STORES.articles, data),
  delete: (id) => deleteItem(STORES.articles, id),
  get: (id) => getItem(STORES.articles, id),
  getAll: () => getAllItems(STORES.articles),
  search: async (query) => {
    const all = await getAllItems(STORES.articles);
    const q = query.toLowerCase();
    return all.filter(a =>
      a.title?.toLowerCase().includes(q) ||
      a.body?.toLowerCase().includes(q) ||
      a.tags?.toLowerCase().includes(q)
    );
  }
};

// ── File → Base64 Utility ─────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Cross-Content Search ──────────────────────────────────
async function searchAll(query) {
  const [songs, images, videos, articles] = await Promise.all([
    Songs.search(query),
    Images.search(query),
    Videos.search(query),
    Articles.search(query),
  ]);
  return {
    songs: songs.map(s => ({ ...s, _type: 'song' })),
    images: images.map(i => ({ ...i, _type: 'image' })),
    videos: videos.map(v => ({ ...v, _type: 'video' })),
    articles: articles.map(a => ({ ...a, _type: 'article' })),
  };
}

// ── Count ─────────────────────────────────────────────────
async function getCounts() {
  await openDB();
  const [songs, images, videos, articles] = await Promise.all([
    getAllItems(STORES.songs),
    getAllItems(STORES.images),
    getAllItems(STORES.videos),
    getAllItems(STORES.articles),
  ]);
  return {
    songs: songs.length,
    images: images.length,
    videos: videos.length,
    articles: articles.length,
  };
}

// ── Export ────────────────────────────────────────────────
window.CMS = { Songs, Images, Videos, Articles, fileToBase64, searchAll, getCounts, openDB };
