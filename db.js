// ============================================================
//  db.js — Supabase Data Layer for Creator CMS
//  Public reads  → anon key (config.js)
//  Admin writes  → service key (entered at admin login)
// ============================================================

let _publicClient = null;
let _adminClient = null;

// ── Client factories ─────────────────────────────────────────
function getPublicClient() {
  if (!_publicClient) {
    if (!window.IS_SUPABASE_CONFIGURED) return null;
    _publicClient = supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );
  }
  return _publicClient;
}

function getAdminClient() {
  if (_adminClient) return _adminClient;
  const svcKey = sessionStorage.getItem('cms_service_key');
  if (!svcKey) throw new Error('Admin not authenticated. Please log in with your service key.');
  _adminClient = supabase.createClient(
    window.SUPABASE_URL,
    svcKey,
    { auth: { persistSession: false } }
  );
  return _adminClient;
}

function resetAdminClient() { _adminClient = null; }

// ── Generic query helpers ────────────────────────────────────
async function dbSelect(table, query = '*') {
  const client = getPublicClient();
  if (!client) return [];
  const { data, error } = await client
    .from(table)
    .select(query)
    .order('created_at', { ascending: false });
  if (error) { console.error('DB select error:', error); return []; }
  return data || [];
}

async function dbSelectById(table, id) {
  const client = getPublicClient();
  if (!client) return null;
  const { data, error } = await client
    .from(table)
    .select('*')
    .eq('id', id)
    .single();
  if (error) { console.error('DB get error:', error); return null; }
  return data;
}

async function dbInsert(table, row) {
  const { data, error } = await getAdminClient()
    .from(table)
    .insert([row])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function dbUpdate(table, id, row) {
  const { data, error } = await getAdminClient()
    .from(table)
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function dbDelete(table, id) {
  const { error } = await getAdminClient()
    .from(table)
    .delete()
    .eq('id', id);
  if (error) throw error;
}

async function dbSearch(table, field, query) {
  const client = getPublicClient();
  if (!client) return [];
  const { data, error } = await client
    .from(table)
    .select('*')
    .or(field.map(f => `${f}.ilike.%${query}%`).join(','))
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

// ── File upload helper ───────────────────────────────────────
async function uploadFile(bucket, file, onProgress) {
  const client = getAdminClient();
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { data, error } = await client.storage
    .from(bucket)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = client.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

// ── Delete file from storage ─────────────────────────────────
async function deleteStorageFile(bucket, url) {
  if (!url) return;
  try {
    const path = url.split(`/${bucket}/`)[1];
    if (path) await getAdminClient().storage.from(bucket).remove([path]);
  } catch (e) { /* ignore storage delete errors */ }
}

// ============================================================
//  SONGS
// ============================================================
const Songs = {
  getAll: () => dbSelect('songs'),
  get: (id) => dbSelectById('songs', id),

  add: async (data) => {
    const { mp3File, coverFile, onProgress, ...meta } = data;
    const row = { ...meta };
    if (mp3File) row.mp3_url = await uploadFile(BUCKETS.songs, mp3File, onProgress);
    if (coverFile) row.cover_url = await uploadFile(BUCKETS.covers, coverFile, onProgress);
    return dbInsert('songs', row);
  },

  update: async (id, data) => {
    const { mp3File, coverFile, onProgress, ...meta } = data;
    const row = { ...meta };
    if (mp3File) row.mp3_url = await uploadFile(BUCKETS.songs, mp3File);
    if (coverFile) row.cover_url = await uploadFile(BUCKETS.covers, coverFile);
    return dbUpdate('songs', id, row);
  },

  delete: async (id) => {
    const song = await dbSelectById('songs', id);
    await dbDelete('songs', id);
    if (song) {
      await deleteStorageFile(BUCKETS.songs, song.mp3_url);
      await deleteStorageFile(BUCKETS.covers, song.cover_url);
    }
  },

  search: (q) => dbSearch('songs', ['title', 'artist', 'genre', 'lyrics'], q),
};

// ============================================================
//  IMAGES
// ============================================================
const Images = {
  getAll: () => dbSelect('images'),
  get: (id) => dbSelectById('images', id),

  add: async (data) => {
    const { imageFile, onProgress, ...meta } = data;
    const row = { ...meta };
    if (imageFile) row.file_url = await uploadFile(BUCKETS.images, imageFile, onProgress);
    return dbInsert('images', row);
  },

  update: async (id, data) => {
    const { imageFile, ...meta } = data;
    const row = { ...meta };
    if (imageFile) row.file_url = await uploadFile(BUCKETS.images, imageFile);
    return dbUpdate('images', id, row);
  },

  delete: async (id) => {
    const img = await dbSelectById('images', id);
    await dbDelete('images', id);
    if (img) await deleteStorageFile(BUCKETS.images, img.file_url);
  },

  search: (q) => dbSearch('images', ['title', 'category', 'description'], q),
};

// ============================================================
//  VIDEOS
// ============================================================
const Videos = {
  getAll: () => dbSelect('videos'),
  get: (id) => dbSelectById('videos', id),

  add: async (data) => {
    const { videoFile, thumbFile, onProgress, ...meta } = data;
    const row = { ...meta };
    if (videoFile) row.file_url = await uploadFile(BUCKETS.videos, videoFile, onProgress);
    if (thumbFile) row.thumbnail_url = await uploadFile(BUCKETS.covers, thumbFile);
    return dbInsert('videos', row);
  },

  update: async (id, data) => {
    const { videoFile, thumbFile, ...meta } = data;
    const row = { ...meta };
    if (videoFile) row.file_url = await uploadFile(BUCKETS.videos, videoFile);
    if (thumbFile) row.thumbnail_url = await uploadFile(BUCKETS.covers, thumbFile);
    return dbUpdate('videos', id, row);
  },

  delete: async (id) => {
    const vid = await dbSelectById('videos', id);
    await dbDelete('videos', id);
    if (vid) {
      await deleteStorageFile(BUCKETS.videos, vid.file_url);
      await deleteStorageFile(BUCKETS.covers, vid.thumbnail_url);
    }
  },

  search: (q) => dbSearch('videos', ['title', 'description'], q),
};

// ============================================================
//  ARTICLES
// ============================================================
const Articles = {
  getAll: () => dbSelect('articles'),
  get: (id) => dbSelectById('articles', id),

  add: async (data) => {
    const { coverFile, onProgress, ...meta } = data;
    const row = { ...meta };
    if (coverFile) row.cover_url = await uploadFile(BUCKETS.covers, coverFile, onProgress);
    return dbInsert('articles', row);
  },

  update: async (id, data) => {
    const { coverFile, ...meta } = data;
    const row = { ...meta };
    if (coverFile) row.cover_url = await uploadFile(BUCKETS.covers, coverFile);
    return dbUpdate('articles', id, row);
  },

  delete: async (id) => {
    const art = await dbSelectById('articles', id);
    await dbDelete('articles', id);
    if (art) await deleteStorageFile(BUCKETS.covers, art.cover_url);
  },

  search: (q) => dbSearch('articles', ['title', 'body', 'tags'], q),
};

// ============================================================
//  CROSS-CONTENT SEARCH
// ============================================================
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

// ============================================================
//  COUNTS
// ============================================================
async function getCounts() {
  const client = getPublicClient();
  if (!client) return { songs: 0, images: 0, videos: 0, articles: 0 };

  const counts = await Promise.all(
    ['songs', 'images', 'videos', 'articles'].map(async (t) => {
      const { count } = await client
        .from(t)
        .select('id', { count: 'exact', head: true });
      return count || 0;
    })
  );
  return {
    songs: counts[0],
    images: counts[1],
    videos: counts[2],
    articles: counts[3],
  };
}

// ── Map DB field names → app field names for public site ─────
// DB uses mp3_url / file_url / cover_url — app.js uses mp3 / file / cover
function normalizeSong(s) { return s ? { ...s, mp3: s.mp3_url, cover: s.cover_url } : null; }
function normalizeImage(i) { return i ? { ...i, file: i.file_url } : null; }
function normalizeVideo(v) { return v ? { ...v, file: v.file_url, thumbnail: v.thumbnail_url } : null; }
function normalizeArticle(a) { return a ? { ...a, cover: a.cover_url } : null; }

// ── Normalized wrappers for app.js ───────────────────────────
const NormSongs = { getAll: async () => (await Songs.getAll()).map(normalizeSong), get: async (id) => normalizeSong(await Songs.get(id)) };
const NormImages = { getAll: async () => (await Images.getAll()).map(normalizeImage), get: async (id) => normalizeImage(await Images.get(id)) };
const NormVideos = { getAll: async () => (await Videos.getAll()).map(normalizeVideo), get: async (id) => normalizeVideo(await Videos.get(id)) };
const NormArticles = { getAll: async () => (await Articles.getAll()).map(normalizeArticle), get: async (id) => normalizeArticle(await Articles.get(id)) };

async function searchAllNorm(query) {
  const r = await searchAll(query);
  return {
    songs: r.songs.map(normalizeSong),
    images: r.images.map(normalizeImage),
    videos: r.videos.map(normalizeVideo),
    articles: r.articles.map(normalizeArticle),
  };
}

// ── Export ────────────────────────────────────────────────────
window.CMS = {
  // Admin (raw, DB field names)
  Songs, Images, Videos, Articles,
  uploadFile, resetAdminClient,

  // Public app (normalized field names)
  NormSongs, NormImages, NormVideos, NormArticles,
  searchAll: searchAllNorm,
  getCounts,

  getPublicClient, getAdminClient,
};
