// ============================================================
//  config.js — Supabase Configuration
//  Edit this file with your own Supabase project credentials
// ============================================================

// ── STEP 1: Get these from https://supabase.com
//   Dashboard → Your Project → Settings → API
// ────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://mpvdlqqqginbvryytvfd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wdmRscXFxZ2luYnZyeXl0dmZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTIyNzcsImV4cCI6MjA4Nzg2ODI3N30.UiVjX6uV6N-H0KquO69L2LNz4cnJQ5Usq_COCdBaBik';

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
