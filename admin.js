// ============================================================
//  admin.js — Creator CMS Admin Logic (Supabase Edition)
//  Auth: local username/password + Supabase service role key
// ============================================================

// ── Auth ──────────────────────────────────────────────
const AUTH_SES_KEY = 'cms_auth';
const SVC_KEY_NAME = 'cms_service_key';
const ADMIN_CREDS = { username: 'admin', password: 'admin123' };

function isLoggedIn() { return sessionStorage.getItem(AUTH_SES_KEY) === 'true'; }
function doLogout() {
    sessionStorage.removeItem(AUTH_SES_KEY);
    sessionStorage.removeItem(SVC_KEY_NAME);
    CMS.resetAdminClient();
    location.reload();
}

function initAuth() {
    if (isLoggedIn()) { showApp(); return; }

    const loginBtn = document.getElementById('login-btn');
    loginBtn?.addEventListener('click', tryLogin);
    document.getElementById('login-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
    document.getElementById('login-user')?.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('login-pass').focus(); });
}

function tryLogin() {
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value;
    const s = document.getElementById('login-svckey').value.trim();

    const stored = JSON.parse(localStorage.getItem('cms_creds') || 'null');
    const creds = stored || ADMIN_CREDS;

    if (u !== creds.username || p !== creds.password) {
        showLoginError('Incorrect username or password'); return;
    }
    if (!s) {
        showLoginError('Please enter your Supabase Service Role Key'); return;
    }
    if (!window.IS_SUPABASE_CONFIGURED) {
        showLoginError('Supabase not configured — edit config.js first'); return;
    }

    sessionStorage.setItem(AUTH_SES_KEY, 'true');
    sessionStorage.setItem(SVC_KEY_NAME, s);
    showApp();
}

function showLoginError(msg) {
    const el = document.getElementById('login-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').classList.add('active');
    document.getElementById('logout-btn').addEventListener('click', doLogout);
    Admin.init();
}

// ── Toast ──────────────────────────────────────────────
function toast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.textContent = (type === 'success' ? '✅ ' : '❌ ') + msg;
    t.className = `show ${type}`;
    setTimeout(() => { t.className = ''; }, 4000);
}

// ── Upload Progress ────────────────────────────────────
function showProgress(barId, pct) {
    const el = document.getElementById(barId);
    if (!el) return;
    el.style.display = 'block';
    el.querySelector('.progress-fill').style.width = `${Math.round(pct)}%`;
    el.querySelector('.progress-label').textContent = `${Math.round(pct)}%`;
}
function hideProgress(barId) {
    const el = document.getElementById(barId);
    if (el) el.style.display = 'none';
}

// ── Rich text helper ──────────────────────────────────
function execCmd(cmd, val = null) {
    document.getElementById('af-body').focus();
    document.execCommand(cmd, false, val);
}
window.execCmd = execCmd;

// ── File Drop Setup ───────────────────────────────────
function setupFileDrop(dropId, inputId, previewId, type) {
    const drop = document.getElementById(dropId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!drop || !input) return;

    drop.addEventListener('click', () => input.click());
    input.addEventListener('change', () => previewFile(input.files, preview, type));

    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', e => {
        e.preventDefault(); drop.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            input.files = e.dataTransfer.files;
            previewFile(e.dataTransfer.files, preview, type);
        }
    });
}

function previewFile(files, preview, type) {
    if (!files?.length || !preview) return;
    preview.innerHTML = '';
    const file = files[0];
    const size = file.size > 1024 * 1024
        ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
        : `${(file.size / 1024).toFixed(1)} KB`;
    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = `📎 ${file.name} (${size})`;
    preview.appendChild(name);

    if (type === 'image') {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        preview.appendChild(img);
    } else if (type === 'audio') {
        const audio = document.createElement('audio');
        audio.src = URL.createObjectURL(file);
        audio.controls = true; audio.style.width = '100%';
        preview.appendChild(audio);
    } else if (type === 'video') {
        const vid = document.createElement('video');
        vid.src = URL.createObjectURL(file);
        vid.controls = true; vid.style.maxHeight = '160px'; vid.style.width = '100%';
        preview.appendChild(vid);
    }

    // Warn about 50MB free tier limit
    if (file.size > 45 * 1024 * 1024) {
        const warn = document.createElement('div');
        warn.style.cssText = 'color:#f59e0b;font-size:0.78rem;margin-top:0.5rem;';
        warn.textContent = '⚠️ File is close to the 50MB Supabase free tier limit.';
        preview.appendChild(warn);
    }
}

// ── Helpers ──────────────────────────────────────────
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function fmtDate(ts) { return new Date(ts || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
function clearInput(inputId, previewId) {
    const i = document.getElementById(inputId); if (i) i.value = '';
    const p = document.getElementById(previewId); if (p) p.innerHTML = '';
}

// ── Admin Module ──────────────────────────────────────
const Admin = (() => {

    async function init() {
        setupNavigation();
        setupFileDrop('mp3-drop', 'sf-mp3', 'mp3-preview', 'audio');
        setupFileDrop('cover-drop', 'sf-cover', 'cover-preview', 'image');
        setupFileDrop('img-drop', 'if-file', 'img-preview', 'image');
        setupFileDrop('vid-drop', 'vf-file', 'vid-preview', 'video');
        setupFileDrop('thumb-drop', 'vf-thumb', 'thumb-preview', 'image');
        setupFileDrop('artcover-drop', 'af-cover', 'artcover-preview', 'image');
        setupSongsPanel();
        setupImagesPanel();
        setupVideosPanel();
        setupArticlesPanel();
        loadDashboard();
    }

    // ── Navigation ──────────────────────────────────────
    function setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => switchPanel(item.dataset.panel));
        });
    }

    function switchPanel(name) {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.querySelector(`.nav-item[data-panel="${name}"]`)?.classList.add('active');
        document.getElementById(`panel-${name}`)?.classList.add('active');
        document.getElementById('topbar-title').textContent =
            { dashboard: 'Dashboard', songs: 'Songs', images: 'Images & PNG Files', videos: 'Videos', articles: 'Articles' }[name] || name;

        if (name === 'dashboard') loadDashboard();
        if (name === 'songs') loadSongs();
        if (name === 'images') loadImages();
        if (name === 'videos') loadVideos();
        if (name === 'articles') loadArticles();
    }

    // ── Dashboard ───────────────────────────────────────
    async function loadDashboard() {
        const counts = await CMS.getCounts();
        document.getElementById('dash-stats').innerHTML = `
      <div class="dash-card" onclick="Admin.switchPanel('songs')">
        <div class="d-icon">🎵</div><div class="d-num">${counts.songs}</div><div class="d-label">Songs</div>
      </div>
      <div class="dash-card" onclick="Admin.switchPanel('images')">
        <div class="d-icon">🖼</div><div class="d-num">${counts.images}</div><div class="d-label">Images</div>
      </div>
      <div class="dash-card" onclick="Admin.switchPanel('videos')">
        <div class="d-icon">🎬</div><div class="d-num">${counts.videos}</div><div class="d-label">Videos</div>
      </div>
      <div class="dash-card" onclick="Admin.switchPanel('articles')">
        <div class="d-icon">📰</div><div class="d-num">${counts.articles}</div><div class="d-label">Articles</div>
      </div>`;

        const [songs, images, videos, articles] = await Promise.all([
            CMS.Songs.getAll(), CMS.Images.getAll(), CMS.Videos.getAll(), CMS.Articles.getAll()
        ]);
        const all = [
            ...songs.map(s => ({ ...s, _type: 'song' })),
            ...images.map(i => ({ ...i, _type: 'image' })),
            ...videos.map(v => ({ ...v, _type: 'video' })),
            ...articles.map(a => ({ ...a, _type: 'article' })),
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);

        const icons = { song: '🎵', image: '🖼', video: '🎬', article: '📰' };
        const recent = document.getElementById('recent-list');
        if (!all.length) {
            recent.innerHTML = '<div class="empty"><div class="e-icon">📭</div><p>No uploads yet!</p></div>';
            return;
        }
        recent.innerHTML = all.map(item => {
            const thumb = item.cover_url || item.file_url || item.thumbnail_url;
            return `<div class="content-item">
        ${thumb ? `<img class="ci-thumb" src="${thumb}" alt="" loading="lazy">` : `<div class="ci-thumb-ph">${icons[item._type]}</div>`}
        <div class="ci-info">
          <div class="name">${esc(item.title || 'Untitled')}</div>
          <div class="sub">${fmtDate(item.created_at)} · <span class="ci-badge">${item._type}</span></div>
        </div>
      </div>`;
        }).join('');
    }

    // ─────────────────────────────────────────────────────
    //  SONGS
    // ─────────────────────────────────────────────────────
    function setupSongsPanel() {
        document.getElementById('add-song-btn').addEventListener('click', () => showSongForm());
        document.getElementById('save-song-btn').addEventListener('click', saveSong);
        document.getElementById('cancel-song-btn').addEventListener('click', () => {
            document.getElementById('song-form-card').style.display = 'none';
            resetSongForm();
        });
    }

    function showSongForm(song = null) {
        const fc = document.getElementById('song-form-card');
        fc.style.display = 'block';
        fc.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('song-form-title').textContent = song ? '✏ Edit Song' : '🎵 Add New Song';
        document.getElementById('sf-title').value = song?.title || '';
        document.getElementById('sf-artist').value = song?.artist || '';
        document.getElementById('sf-genre').value = song?.genre || '';
        document.getElementById('sf-tags').value = song?.tags || '';
        document.getElementById('sf-lyrics').value = song?.lyrics || '';
        document.getElementById('sf-edit-id').value = song?.id || '';
        clearInput('sf-mp3', 'mp3-preview');
        clearInput('sf-cover', 'cover-preview');
        if (song?.cover_url) {
            document.getElementById('cover-preview').innerHTML = `<img src="${song.cover_url}" style="max-height:100px;border-radius:8px;">`;
        }
    }

    function resetSongForm() {
        ['sf-title', 'sf-artist', 'sf-genre', 'sf-tags', 'sf-lyrics', 'sf-edit-id'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        clearInput('sf-mp3', 'mp3-preview');
        clearInput('sf-cover', 'cover-preview');
        hideProgress('song-upload-progress');
    }

    async function saveSong() {
        const title = document.getElementById('sf-title').value.trim();
        const editId = document.getElementById('sf-edit-id').value;
        const mp3Input = document.getElementById('sf-mp3');
        const coverInput = document.getElementById('sf-cover');

        if (!title) { toast('Song title is required', 'error'); return; }
        if (!editId && !mp3Input.files[0]) { toast('Please select an MP3 file', 'error'); return; }

        const btn = document.getElementById('save-song-btn');
        btn.disabled = true; btn.textContent = '⏳ Uploading...';
        showProgress('song-upload-progress', 10);

        try {
            const meta = {
                title,
                artist: document.getElementById('sf-artist').value.trim(),
                genre: document.getElementById('sf-genre').value.trim(),
                tags: document.getElementById('sf-tags').value.trim(),
                lyrics: document.getElementById('sf-lyrics').value.trim(),
            };

            showProgress('song-upload-progress', 30);

            if (editId) {
                const updates = { ...meta };
                if (mp3Input.files[0]) updates.mp3File = mp3Input.files[0];
                if (coverInput.files[0]) updates.coverFile = coverInput.files[0];
                showProgress('song-upload-progress', 60);
                await CMS.Songs.update(Number(editId), updates);
                toast('Song updated!');
            } else {
                showProgress('song-upload-progress', 50);
                await CMS.Songs.add({
                    ...meta,
                    mp3File: mp3Input.files[0],
                    coverFile: coverInput.files[0] || null,
                });
                toast('Song uploaded to Supabase! 🎵');
            }

            showProgress('song-upload-progress', 100);
            setTimeout(() => hideProgress('song-upload-progress'), 800);
            document.getElementById('song-form-card').style.display = 'none';
            resetSongForm(); loadSongs();
        } catch (err) {
            toast('Upload failed: ' + err.message, 'error');
            hideProgress('song-upload-progress');
        }
        btn.disabled = false; btn.textContent = '💾 Save Song';
    }

    async function loadSongs() {
        const list = document.getElementById('songs-list');
        list.innerHTML = '<div class="spinner"></div>';
        const songs = await CMS.Songs.getAll();
        if (!songs.length) {
            list.innerHTML = '<div class="empty"><div class="e-icon">🎵</div><p>No songs yet.</p></div>';
            return;
        }
        list.innerHTML = songs.map(s => `
      <div class="content-item">
        ${s.cover_url ? `<img class="ci-thumb" src="${s.cover_url}" alt="" loading="lazy">` : `<div class="ci-thumb-ph">🎵</div>`}
        <div class="ci-info">
          <div class="name">${esc(s.title)}</div>
          <div class="sub">${esc(s.artist || '')} ${s.genre ? '· ' + esc(s.genre) : ''} · ${fmtDate(s.created_at)} ${s.lyrics ? '· 📃 Lyrics' : ''}</div>
        </div>
        <div class="ci-actions">
          <button class="btn btn-ghost" style="font-size:0.78rem;" onclick="Admin.editSong(${s.id})">✏ Edit</button>
          <button class="btn btn-danger" style="font-size:0.78rem;" onclick="Admin.deleteSong(${s.id})">🗑</button>
        </div>
      </div>`).join('');
    }

    async function editSong(id) {
        try {
            // Use admin client to bypass any RLS issues when fetching for edit
            const { data, error } = await CMS.getAdminClient()
                .from('songs').select('*').eq('id', id).single();
            if (error) throw error;
            if (data) showSongForm(data);
            else toast('Song not found', 'error');
        } catch (e) { toast('Load error: ' + e.message, 'error'); }
    }
    async function deleteSong(id) {
        if (!confirm('Delete this song and its files from Supabase?')) return;
        try {
            await CMS.Songs.delete(id);
            toast('Song deleted'); loadSongs(); loadDashboard();
        } catch (e) { toast('Delete error: ' + e.message, 'error'); }
    }

    // ─────────────────────────────────────────────────────
    //  IMAGES
    // ─────────────────────────────────────────────────────
    function setupImagesPanel() {
        document.getElementById('add-image-btn').addEventListener('click', () => showImageForm());
        document.getElementById('save-image-btn').addEventListener('click', saveImage);
        document.getElementById('cancel-image-btn').addEventListener('click', () => {
            document.getElementById('image-form-card').style.display = 'none';
            resetImageForm();
        });
    }

    function showImageForm(img = null) {
        const fc = document.getElementById('image-form-card');
        fc.style.display = 'block';
        fc.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('image-form-title').textContent = img ? '✏ Edit Image' : '🖼 Upload Image';
        document.getElementById('if-title').value = img?.title || '';
        document.getElementById('if-category').value = img?.category || '';
        document.getElementById('if-desc').value = img?.description || '';
        document.getElementById('if-tags').value = img?.tags || '';
        document.getElementById('if-edit-id').value = img?.id || '';
        clearInput('if-file', 'img-preview');
        if (img?.file_url) {
            document.getElementById('img-preview').innerHTML = `<img src="${img.file_url}" style="max-height:100px;border-radius:8px;">`;
        }
    }

    function resetImageForm() {
        ['if-title', 'if-category', 'if-desc', 'if-tags', 'if-edit-id'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        clearInput('if-file', 'img-preview');
        hideProgress('image-upload-progress');
    }

    async function saveImage() {
        const title = document.getElementById('if-title').value.trim();
        const fileInput = document.getElementById('if-file');
        const editId = document.getElementById('if-edit-id').value;
        if (!title) { toast('Image title is required', 'error'); return; }

        const btn = document.getElementById('save-image-btn');
        btn.disabled = true; btn.textContent = '⏳ Uploading...';
        showProgress('image-upload-progress', 20);

        try {
            const base = {
                title,
                category: document.getElementById('if-category').value.trim(),
                description: document.getElementById('if-desc').value.trim(),
                tags: document.getElementById('if-tags').value.trim(),
            };

            if (editId && !fileInput.files.length) {
                showProgress('image-upload-progress', 70);
                await CMS.Images.update(Number(editId), base);
                toast('Image updated!');
            } else if (!fileInput.files.length) {
                toast('Please select an image file', 'error');
                btn.disabled = false; btn.textContent = '💾 Save Image(s)';
                hideProgress('image-upload-progress');
                return;
            } else {
                // Support multiple image uploads
                const files = [...fileInput.files];
                let done = 0;
                for (const file of files) {
                    const t = files.length > 1 ? file.name.replace(/\.[^.]+$/, '') : title;
                    await CMS.Images.add({ ...base, title: t, imageFile: file });
                    done++;
                    showProgress('image-upload-progress', (done / files.length) * 90);
                }
                toast(`${files.length} image(s) uploaded! 🖼`);
            }

            showProgress('image-upload-progress', 100);
            setTimeout(() => hideProgress('image-upload-progress'), 800);
            document.getElementById('image-form-card').style.display = 'none';
            resetImageForm(); loadImages();
        } catch (err) { toast('Upload failed: ' + err.message, 'error'); hideProgress('image-upload-progress'); }
        btn.disabled = false; btn.textContent = '💾 Save Image(s)';
    }

    async function loadImages() {
        const list = document.getElementById('images-list');
        list.innerHTML = '<div class="spinner"></div>';
        const imgs = await CMS.Images.getAll();
        if (!imgs.length) { list.innerHTML = '<div class="empty"><div class="e-icon">🖼</div><p>No images yet.</p></div>'; return; }
        list.innerHTML = imgs.map(img => `
      <div class="content-item">
        ${img.file_url ? `<img class="ci-thumb" src="${img.file_url}" alt="" loading="lazy">` : `<div class="ci-thumb-ph">🖼</div>`}
        <div class="ci-info">
          <div class="name">${esc(img.title)}</div>
          <div class="sub">${esc(img.category || '')} · ${fmtDate(img.created_at)}</div>
        </div>
        <div class="ci-actions">
          <button class="btn btn-ghost" style="font-size:0.78rem;" onclick="Admin.editImage(${img.id})">✏ Edit</button>
          <button class="btn btn-danger" style="font-size:0.78rem;" onclick="Admin.deleteImage(${img.id})">🗑</button>
        </div>
      </div>`).join('');
    }

    async function editImage(id) {
        try {
            const { data, error } = await CMS.getAdminClient()
                .from('images').select('*').eq('id', id).single();
            if (error) throw error;
            if (data) showImageForm(data);
        } catch (e) { toast('Load error: ' + e.message, 'error'); }
    }
    async function deleteImage(id) {
        if (!confirm('Delete this image from Supabase?')) return;
        try {
            await CMS.Images.delete(id); toast('Image deleted'); loadImages(); loadDashboard();
        } catch (e) { toast('Delete error: ' + e.message, 'error'); }
    }

    // ─────────────────────────────────────────────────────
    //  VIDEOS
    // ─────────────────────────────────────────────────────
    function setupVideosPanel() {
        document.getElementById('add-video-btn').addEventListener('click', () => showVideoForm());
        document.getElementById('save-video-btn').addEventListener('click', saveVideo);
        document.getElementById('cancel-video-btn').addEventListener('click', () => {
            document.getElementById('video-form-card').style.display = 'none';
            resetVideoForm();
        });
    }

    function showVideoForm(vid = null) {
        const fc = document.getElementById('video-form-card');
        fc.style.display = 'block';
        fc.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('video-form-title').textContent = vid ? '✏ Edit Video' : '🎬 Upload Video';
        document.getElementById('vf-title').value = vid?.title || '';
        document.getElementById('vf-desc').value = vid?.description || '';
        document.getElementById('vf-tags').value = vid?.tags || '';
        document.getElementById('vf-edit-id').value = vid?.id || '';
        clearInput('vf-file', 'vid-preview');
        clearInput('vf-thumb', 'thumb-preview');
        if (vid?.thumbnail_url) document.getElementById('thumb-preview').innerHTML = `<img src="${vid.thumbnail_url}" style="max-height:80px;border-radius:8px;">`;
    }

    function resetVideoForm() {
        ['vf-title', 'vf-desc', 'vf-tags', 'vf-edit-id'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        clearInput('vf-file', 'vid-preview');
        clearInput('vf-thumb', 'thumb-preview');
        hideProgress('video-upload-progress');
    }

    async function saveVideo() {
        const title = document.getElementById('vf-title').value.trim();
        const fileInput = document.getElementById('vf-file');
        const thumbInput = document.getElementById('vf-thumb');
        const editId = document.getElementById('vf-edit-id').value;
        if (!title) { toast('Video title is required', 'error'); return; }

        const btn = document.getElementById('save-video-btn');
        btn.disabled = true; btn.textContent = '⏳ Uploading...';
        showProgress('video-upload-progress', 15);

        try {
            const base = {
                title,
                description: document.getElementById('vf-desc').value.trim(),
                tags: document.getElementById('vf-tags').value.trim(),
            };

            if (editId) {
                const updates = { ...base };
                if (fileInput.files[0]) updates.videoFile = fileInput.files[0];
                if (thumbInput.files[0]) updates.thumbFile = thumbInput.files[0];
                showProgress('video-upload-progress', 60);
                await CMS.Videos.update(Number(editId), updates);
                toast('Video updated!');
            } else {
                if (!fileInput.files[0]) { toast('Please select a video file', 'error'); btn.disabled = false; btn.textContent = '💾 Save Video'; hideProgress('video-upload-progress'); return; }
                showProgress('video-upload-progress', 40);
                await CMS.Videos.add({
                    ...base,
                    videoFile: fileInput.files[0],
                    thumbFile: thumbInput.files[0] || null,
                });
                toast('Video uploaded to Supabase! 🎬');
            }

            showProgress('video-upload-progress', 100);
            setTimeout(() => hideProgress('video-upload-progress'), 800);
            document.getElementById('video-form-card').style.display = 'none';
            resetVideoForm(); loadVideos();
        } catch (err) { toast('Upload failed: ' + err.message, 'error'); hideProgress('video-upload-progress'); }
        btn.disabled = false; btn.textContent = '💾 Save Video';
    }

    async function loadVideos() {
        const list = document.getElementById('videos-list');
        list.innerHTML = '<div class="spinner"></div>';
        const vids = await CMS.Videos.getAll();
        if (!vids.length) { list.innerHTML = '<div class="empty"><div class="e-icon">🎬</div><p>No videos yet.</p></div>'; return; }
        list.innerHTML = vids.map(v => `
      <div class="content-item">
        ${v.thumbnail_url ? `<img class="ci-thumb" src="${v.thumbnail_url}" alt="" loading="lazy">` : `<div class="ci-thumb-ph">🎬</div>`}
        <div class="ci-info">
          <div class="name">${esc(v.title)}</div>
          <div class="sub">${fmtDate(v.created_at)}${v.tags ? ' · ' + esc(v.tags) : ''}</div>
        </div>
        <div class="ci-actions">
          <button class="btn btn-ghost" style="font-size:0.78rem;" onclick="Admin.editVideo(${v.id})">✏ Edit</button>
          <button class="btn btn-danger" style="font-size:0.78rem;" onclick="Admin.deleteVideo(${v.id})">🗑</button>
        </div>
      </div>`).join('');
    }

    async function editVideo(id) {
        try {
            const { data, error } = await CMS.getAdminClient()
                .from('videos').select('*').eq('id', id).single();
            if (error) throw error;
            if (data) showVideoForm(data);
        } catch (e) { toast('Load error: ' + e.message, 'error'); }
    }
    async function deleteVideo(id) {
        if (!confirm('Delete this video from Supabase?')) return;
        try {
            await CMS.Videos.delete(id); toast('Video deleted'); loadVideos(); loadDashboard();
        } catch (e) { toast('Delete error: ' + e.message, 'error'); }
    }

    // ─────────────────────────────────────────────────────
    //  ARTICLES
    // ─────────────────────────────────────────────────────
    function setupArticlesPanel() {
        document.getElementById('add-article-btn').addEventListener('click', () => showArticleForm());
        document.getElementById('save-article-btn').addEventListener('click', saveArticle);
        document.getElementById('cancel-article-btn').addEventListener('click', () => {
            document.getElementById('article-form-card').style.display = 'none';
            resetArticleForm();
        });
    }

    function showArticleForm(art = null) {
        const fc = document.getElementById('article-form-card');
        fc.style.display = 'block';
        fc.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('article-form-title').textContent = art ? '✏ Edit Article' : '📰 Write Article';
        document.getElementById('af-title').value = art?.title || '';
        document.getElementById('af-tags').value = art?.tags || '';
        document.getElementById('af-body').innerHTML = art?.body || '';
        document.getElementById('af-edit-id').value = art?.id || '';
        clearInput('af-cover', 'artcover-preview');
        if (art?.cover_url) document.getElementById('artcover-preview').innerHTML = `<img src="${art.cover_url}" style="max-height:80px;border-radius:8px;">`;
    }

    function resetArticleForm() {
        ['af-title', 'af-tags', 'af-edit-id'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        document.getElementById('af-body').innerHTML = '';
        clearInput('af-cover', 'artcover-preview');
    }

    async function saveArticle() {
        const title = document.getElementById('af-title').value.trim();
        const body = document.getElementById('af-body').innerHTML.trim();
        const editId = document.getElementById('af-edit-id').value;
        const coverInput = document.getElementById('af-cover');
        if (!title) { toast('Article title is required', 'error'); return; }
        if (!body || body === '<br>') { toast('Please write some content', 'error'); return; }

        const btn = document.getElementById('save-article-btn');
        btn.disabled = true; btn.textContent = '⏳ Saving...';

        try {
            const data = {
                title, body,
                tags: document.getElementById('af-tags').value.trim(),
                coverFile: coverInput.files[0] || null,
            };

            if (editId) {
                await CMS.Articles.update(Number(editId), data);
                toast('Article updated!');
            } else {
                await CMS.Articles.add(data);
                toast('Article published! 📰');
            }
            document.getElementById('article-form-card').style.display = 'none';
            resetArticleForm(); loadArticles();
        } catch (err) { toast('Save failed: ' + err.message, 'error'); }
        btn.disabled = false; btn.textContent = '💾 Save Article';
    }

    async function loadArticles() {
        const list = document.getElementById('articles-list');
        list.innerHTML = '<div class="spinner"></div>';
        const arts = await CMS.Articles.getAll();
        if (!arts.length) { list.innerHTML = '<div class="empty"><div class="e-icon">📰</div><p>No articles yet.</p></div>'; return; }
        list.innerHTML = arts.map(a => `
      <div class="content-item">
        ${a.cover_url ? `<img class="ci-thumb" src="${a.cover_url}" alt="" loading="lazy">` : `<div class="ci-thumb-ph">📰</div>`}
        <div class="ci-info">
          <div class="name">${esc(a.title)}</div>
          <div class="sub">${fmtDate(a.created_at)}${a.tags ? ' · ' + esc(a.tags) : ''}</div>
        </div>
        <div class="ci-actions">
          <button class="btn btn-ghost" style="font-size:0.78rem;" onclick="Admin.editArticle(${a.id})">✏ Edit</button>
          <button class="btn btn-danger" style="font-size:0.78rem;" onclick="Admin.deleteArticle(${a.id})">🗑</button>
        </div>
      </div>`).join('');
    }

    async function editArticle(id) {
        try {
            const { data, error } = await CMS.getAdminClient()
                .from('articles').select('*').eq('id', id).single();
            if (error) throw error;
            if (data) showArticleForm(data);
        } catch (e) { toast('Load error: ' + e.message, 'error'); }
    }
    async function deleteArticle(id) {
        if (!confirm('Delete this article?')) return;
        try {
            await CMS.Articles.delete(id); toast('Article deleted'); loadArticles(); loadDashboard();
        } catch (e) { toast('Delete error: ' + e.message, 'error'); }
    }

    return {
        init, switchPanel,
        editSong, deleteSong,
        editImage, deleteImage,
        editVideo, deleteVideo,
        editArticle, deleteArticle,
    };
})();

window.Admin = Admin;

// Boot
document.addEventListener('DOMContentLoaded', initAuth);
