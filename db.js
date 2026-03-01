// ============================================================
//  db.js — Robust Supabase Data Layer
// ============================================================

let _publicClient = null;
let _adminClient = null;

// ── Client Setup ─────────────────────────────────────────────
function getPublicClient() {
  if (!_publicClient && window.IS_SUPABASE_CONFIGURED) {
    _publicClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }
  return _publicClient;
}

function getAdminClient() {
  if (_adminClient) return _adminClient;
  const svcKey = sessionStorage.getItem('cms_service_key');
  if (!svcKey) throw new Error('Not logged in as Admin');
  _adminClient = supabase.createClient(window.SUPABASE_URL, svcKey, { auth: { persistSession: false } });
  return _adminClient;
}

function resetAdminClient() { _adminClient = null; }

// ── Generic DB Helpers ───────────────────────────────────────
async function dbGetAll(table) {
  const c = getPublicClient();
  if (!c) return [];
  const { data, error } = await c.from(table).select('*').order('created_at', { ascending: false });
  if (error) { console.error(`[DB] Error fetching ${table}:`, error); return []; }
  return data || [];
}

async function dbGetById(table, id) {
  const c = getPublicClient();
  if (!c) return null;
  const { data, error } = await c.from(table).select('*').eq('id', Number(id)).single();
  if (error) { console.error(`[DB] Error getting ${table} ${id}:`, error); return null; }
  return data;
}

async function dbInsert(table, row) {
  const { data, error } = await getAdminClient().from(table).insert([row]).select().single();
  if (error) { console.error(`[DB] Insert error on ${table}:`, error); throw error; }
  return data;
}

async function dbUpdate(table, id, row) {
  const { data, error } = await getAdminClient().from(table).update(row).eq('id', Number(id)).select().single();
  if (error) { console.error(`[DB] Update error on ${table} ${id}:`, error); throw error; }
  return data;
}

async function dbDelete(table, id) {
  const { error } = await getAdminClient().from(table).delete().eq('id', Number(id));
  if (error) { console.error(`[DB] Delete error on ${table} ${id}:`, error); throw error; }
}

// ── Storage Helpers ──────────────────────────────────────────
async function uploadFile(folderName, file) {
  if (!file) return null;
  const client = getAdminClient();
  const bucket = 'media';
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${folderName}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  console.log(`[DB] Uploading to ${bucket}/${path}`);
  const { data, error } = await client.storage.from(bucket).upload(path, file, { contentType: file.type });
  if (error) { console.error(`[DB] Upload error:`, error); throw error; }

  const { data: urlData } = client.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}

async function deleteFileUrl(url) {
  if (!url) return;
  try {
    const bucket = 'media';
    const path = url.split(`/${bucket}/`)[1];
    if (path) await getAdminClient().storage.from(bucket).remove([path]);
  } catch (e) { console.error('[DB] Failed to delete storage file:', e); }
}

// ── API Definitions ──────────────────────────────────────────
const Songs = {
  getAll: () => dbGetAll('songs'),
  get: (id) => dbGetById('songs', id),
  add: async (d) => {
    let row = { title: d.title, artist: d.artist, genre: d.genre, lyrics: d.lyrics };
    if (d.mp3File) row.mp3_url = await uploadFile('songs', d.mp3File);
    if (d.coverFile) row.cover_url = await uploadFile('covers', d.coverFile);
    return dbInsert('songs', row);
  },
  update: async (id, d) => {
    let row = { title: d.title, artist: d.artist, genre: d.genre, lyrics: d.lyrics };
    if (d.mp3File) row.mp3_url = await uploadFile('songs', d.mp3File);
    if (d.coverFile) row.cover_url = await uploadFile('covers', d.coverFile);
    return dbUpdate('songs', id, row);
  },
  delete: async (id) => {
    const s = await dbGetById('songs', id);
    await dbDelete('songs', id);
    if (s) { await deleteFileUrl(s.mp3_url); await deleteFileUrl(s.cover_url); }
  }
};

const Images = {
  getAll: () => dbGetAll('images'),
  get: (id) => dbGetById('images', id),
  add: async (d) => {
    let row = { title: d.title, category: d.category, description: d.description };
    if (d.imageFile) row.file_url = await uploadFile('images', d.imageFile);
    return dbInsert('images', row);
  },
  update: async (id, d) => {
    let row = { title: d.title, category: d.category, description: d.description };
    if (d.imageFile) row.file_url = await uploadFile('images', d.imageFile);
    return dbUpdate('images', id, row);
  },
  delete: async (id) => {
    const i = await dbGetById('images', id);
    await dbDelete('images', id);
    if (i) await deleteFileUrl(i.file_url);
  }
};

const Videos = {
  getAll: () => dbGetAll('videos'),
  get: (id) => dbGetById('videos', id),
  add: async (d) => {
    let row = { title: d.title, description: d.description };
    if (d.videoFile) row.file_url = await uploadFile('videos', d.videoFile);
    if (d.thumbFile) row.thumbnail_url = await uploadFile('covers', d.thumbFile);
    return dbInsert('videos', row);
  },
  update: async (id, d) => {
    let row = { title: d.title, description: d.description };
    if (d.videoFile) row.file_url = await uploadFile('videos', d.videoFile);
    if (d.thumbFile) row.thumbnail_url = await uploadFile('covers', d.thumbFile);
    return dbUpdate('videos', id, row);
  },
  delete: async (id) => {
    const v = await dbGetById('videos', id);
    await dbDelete('videos', id);
    if (v) { await deleteFileUrl(v.file_url); await deleteFileUrl(v.thumbnail_url); }
  }
};

const Articles = {
  getAll: () => dbGetAll('articles'),
  get: (id) => dbGetById('articles', id),
  add: async (d) => {
    let row = { title: d.title, body: d.body, tags: d.tags };
    if (d.coverFile) row.cover_url = await uploadFile('covers', d.coverFile);
    return dbInsert('articles', row);
  },
  update: async (id, d) => {
    let row = { title: d.title, body: d.body, tags: d.tags };
    if (d.coverFile) row.cover_url = await uploadFile('covers', d.coverFile);
    return dbUpdate('articles', id, row);
  },
  delete: async (id) => {
    const a = await dbGetById('articles', id);
    await dbDelete('articles', id);
    if (a) await deleteFileUrl(a.cover_url);
  }
};

async function getCounts() {
  const c = getPublicClient();
  if (!c) return { songs: 0, images: 0, videos: 0, articles: 0 };
  const getC = async (t) => { const { count } = await c.from(t).select('*', { count: 'exact', head: true }); return count || 0; };
  const [s, i, v, a] = await Promise.all([getC('songs'), getC('images'), getC('videos'), getC('articles')]);
  return { songs: s, images: i, videos: v, articles: a };
}

// ── App normalizers (translates DB cols to standard UI props) ──
const NormSongs = {
  getAll: async () => (await Songs.getAll()).map(s => ({ ...s, mp3: s.mp3_url, cover: s.cover_url })),
  get: async (id) => { const s = await Songs.get(id); return s ? { ...s, mp3: s.mp3_url, cover: s.cover_url } : null; }
};
const NormImages = {
  getAll: async () => (await Images.getAll()).map(i => ({ ...i, file: i.file_url })),
  get: async (id) => { const i = await Images.get(id); return i ? { ...i, file: i.file_url } : null; }
};
const NormVideos = {
  getAll: async () => (await Videos.getAll()).map(v => ({ ...v, file: v.file_url, thumbnail: v.thumbnail_url })),
  get: async (id) => { const v = await Videos.get(id); return v ? { ...v, file: v.file_url, thumbnail: v.thumbnail_url } : null; }
};
const NormArticles = {
  getAll: async () => (await Articles.getAll()).map(a => ({ ...a, cover: a.cover_url })),
  get: async (id) => { const a = await Articles.get(id); return a ? { ...a, cover: a.cover_url } : null; }
};

window.CMS = {
  getPublicClient, getAdminClient, resetAdminClient, getCounts,
  Songs, Images, Videos, Articles,
  uploadFile,

  // Public app (normalized field names)
  NormSongs, NormImages, NormVideos, NormArticles
};
