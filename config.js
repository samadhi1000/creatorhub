// ============================================================
//  config.js — Supabase Configuration
//  Edit this file with your own Supabase project credentials
// ============================================================

// ── STEP 1: Get these from https://supabase.com
//   Dashboard → Your Project → Settings → API
// ────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';

// ── Storage bucket names (must match what you created) ──────
const BUCKETS = {
    songs: 'songs',    // MP3 audio files
    images: 'images',   // PNG / JPG image files
    videos: 'videos',   // Video files (MP4, WebM)
    covers: 'covers',   // Cover art & thumbnails
};

// ── Export to window ─────────────────────────────────────────
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
window.BUCKETS = BUCKETS;

// ── Config check ─────────────────────────────────────────────
window.IS_SUPABASE_CONFIGURED =
    !SUPABASE_URL.includes('YOUR_PROJECT_ID') &&
    !SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY');
