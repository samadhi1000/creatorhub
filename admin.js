// ========================================================
//  admin.js — Creator CMS Admin Logic
// ========================================================

// ── Auth ──────────────────────────────────────────────
const AUTH_KEY = 'cms_auth';
const ADMIN_CREDS = { username: 'admin', password: 'admin123' };

function isLoggedIn() { return sessionStorage.getItem(AUTH_KEY) === 'true'; }
function doLogin() { sessionStorage.setItem(AUTH_KEY, 'true'); }
function doLogout() { sessionStorage.removeItem(AUTH_KEY); location.reload(); }

function initAuth() {
    if (isLoggedIn()) { showApp(); return; }

    document.getElementById('login-btn').addEventListener('click', () => {
        const u = document.getElementById('login-user').value.trim();
        const p = document.getElementById('login-pass').value;
        // Check stored or default
        const stored = JSON.parse(localStorage.getItem('cms_creds') || 'null');
        const creds = stored || ADMIN_CREDS;
        if (u === creds.username && p === creds.password) {
            doLogin(); showApp();
        } else {
            showLoginError('Incorrect username or password');
        }
    });

    // Enter key
    document.getElementById('login-pass').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('login-btn').click();
    });
    document.getElementById('login-user').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('login-pass').focus();
    });
}

function showLoginError(msg) {
    const el = document.getElementById('login-error');
    el.textContent = msg; el.style.display = 'block';
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
    setTimeout(() => { t.className = ''; }, 3500);
}

// ── Rich text helper ─────────────────────────────────
function execCmd(cmd, val = null) {
    document.getElementById('af-body').focus();
    document.execCommand(cmd, false, val);
}
window.execCmd = execCmd;

// ── File Drop Setup ─────────────────────────────────
function setupFileDrop(dropId, inputId, previewId, type) {
    const drop = document.getElementById(dropId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);

    drop?.addEventListener('click', () => input?.click());
    input?.addEventListener('change', () => handleFileChange(input.files, preview, type));

    drop?.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
    drop?.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop?.addEventListener('drop', e => {
        e.preventDefault(); drop.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            input.files = e.dataTransfer.files;
            handleFileChange(e.dataTransfer.files, preview, type);
        }
    });
}

function handleFileChange(files, preview, type) {
    if (!files || !files.length || !preview) return;
    preview.innerHTML = '';
    const file = files[0];
    const name = document.createElement('div');
    name.className = 'file-name'; name.textContent = `📎 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    preview.appendChild(name);

    if (type === 'image') {
        const url = URL.createObjectURL(file);
        const img = document.createElement('img'); img.src = url;
        preview.appendChild(img);
    } else if (type === 'audio') {
        const url = URL.createObjectURL(file);
        const audio = document.createElement('audio'); audio.src = url; audio.controls = true;
        preview.appendChild(audio);
    } else if (type === 'video') {
        const url = URL.createObjectURL(file);
        const vid = document.createElement('video'); vid.src = url; vid.controls = true;
        vid.style.maxHeight = '160px';
        preview.appendChild(vid);
    }
}

// ── Helpers ───────────────────────────────────────────
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function fmtDate(ts) { return new Date(ts || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
function clearFileInput(inputId, previewId) {
    const i = document.getElementById(inputId); if (i) i.value = '';
    const p = document.getElementById(previewId); if (p) p.innerHTML = '';
}

// ── Admin Module ──────────────────────────────────────
const Admin = (() => {

    async function init() {
        await CMS.openDB();
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

    // ── Navigation ───────────────────────────────────
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

    // ── Dashboard ────────────────────────────────────
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

        // Recent activity
        const [songs, images, videos, articles] = await Promise.all([
            CMS.Songs.getAll(), CMS.Images.getAll(), CMS.Videos.getAll(), CMS.Articles.getAll()
        ]);
        const all = [
            ...songs.map(s => ({ ...s, _type: 'song' })),
            ...images.map(i => ({ ...i, _type: 'image' })),
            ...videos.map(v => ({ ...v, _type: 'video' })),
            ...articles.map(a => ({ ...a, _type: 'article' })),
        ].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8);

        const icons = { song: '🎵', image: '🖼', video: '🎬', article: '📰' };
        const recent = document.getElementById('recent-list');
        if (!all.length) { recent.innerHTML = '<div class="empty"><div class="e-icon">📭</div><p>No uploads yet. Start by adding content!</p></div>'; return; }
        recent.innerHTML = all.map(item => {
            const thumb = item.cover || item.file || item.thumbnail;
            return `<div class="content-item">
        ${thumb ? `<img class="ci-thumb" src="${thumb}" alt="">` : `<div class="ci-thumb-ph">${icons[item._type]}</div>`}
        <div class="ci-info">
          <div class="name">${esc(item.title || 'Untitled')}</div>
          <div class="sub">${fmtDate(item.createdAt)} · <span class="ci-badge">${item._type}</span></div>
        </div>
      </div>`;
        }).join('');
    }

    // ─────────────────────────────────────────────────
    //  SONGS
    // ─────────────────────────────────────────────────
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
        fc.style.display = 'block'; fc.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('song-form-title').textContent = song ? '✏ Edit Song' : '🎵 Add New Song';
        document.getElementById('sf-title').value = song?.title || '';
        document.getElementById('sf-artist').value = song?.artist || '';
        document.getElementById('sf-genre').value = song?.genre || '';
        document.getElementById('sf-tags').value = song?.tags || '';
        document.getElementById('sf-lyrics').value = song?.lyrics || '';
        document.getElementById('sf-edit-id').value = song?.id || '';
        clearFileInput('sf-mp3', 'mp3-preview');
        clearFileInput('sf-cover', 'cover-preview');
        if (song?.cover) {
            document.getElementById('cover-preview').innerHTML = `<img src="${song.cover}" style="max-height:100px;">`;
        }
    }

    function resetSongForm() {
        ['sf-title', 'sf-artist', 'sf-genre', 'sf-tags', 'sf-lyrics', 'sf-edit-id'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        clearFileInput('sf-mp3', 'mp3-preview');
        clearFileInput('sf-cover', 'cover-preview');
    }

    async function saveSong() {
        const title = document.getElementById('sf-title').value.trim();
        const mp3Input = document.getElementById('sf-mp3');
        const editId = document.getElementById('sf-edit-id').value;

        if (!title) { toast('Song title is required', 'error'); return; }

        const btn = document.getElementById('save-song-btn');
        btn.disabled = true; btn.textContent = '⏳ Saving...';

        try {
            let mp3 = null, cover = null;
            if (mp3Input.files[0]) mp3 = await CMS.fileToBase64(mp3Input.files[0]);
            const coverInput = document.getElementById('sf-cover');
            if (coverInput.files[0]) cover = await CMS.fileToBase64(coverInput.files[0]);

            const data = {
                title, artist: document.getElementById('sf-artist').value.trim(),
                genre: document.getElementById('sf-genre').value.trim(),
                tags: document.getElementById('sf-tags').value.trim(),
                lyrics: document.getElementById('sf-lyrics').value.trim(),
            };
            if (mp3) data.mp3 = mp3;
            if (cover) data.cover = cover;

            if (editId) {
                // Editing — keep existing mp3/cover if not changed
                const existing = await CMS.Songs.get(Number(editId));
                data.id = Number(editId);
                data.createdAt = existing.createdAt;
                if (!mp3 && existing.mp3) data.mp3 = existing.mp3;
                if (!cover && existing.cover) data.cover = existing.cover;
                await CMS.Songs.update(data);
                toast('Song updated successfully!');
            } else {
                if (!data.mp3) { toast('Please select an MP3 file', 'error'); btn.disabled = false; btn.textContent = '💾 Save Song'; return; }
                await CMS.Songs.add(data);
                toast('Song added successfully!');
            }

            document.getElementById('song-form-card').style.display = 'none';
            resetSongForm(); loadSongs();
        } catch (err) { toast('Error saving song: ' + err.message, 'error'); }
        btn.disabled = false; btn.textContent = '💾 Save Song';
    }

    async function loadSongs() {
        const list = document.getElementById('songs-list');
        const songs = await CMS.Songs.getAll();
        if (!songs.length) { list.innerHTML = '<div class="empty"><div class="e-icon">🎵</div><p>No songs yet. Add your first song!</p></div>'; return; }
        list.innerHTML = songs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(s => `
      <div class="content-item">
        ${s.cover ? `<img class="ci-thumb" src="${s.cover}" alt="">` : `<div class="ci-thumb-ph">🎵</div>`}
        <div class="ci-info">
          <div class="name">${esc(s.title)}</div>
          <div class="sub">${esc(s.artist || '')} ${s.genre ? '· ' + esc(s.genre) : ''} · ${fmtDate(s.createdAt)} ${s.lyrics ? '· 📃 Has Lyrics' : ''}</div>
        </div>
        <div class="ci-actions">
          <button class="btn btn-ghost" style="font-size:0.78rem;" onclick="Admin.editSong(${s.id})">✏ Edit</button>
          <button class="btn btn-danger" style="font-size:0.78rem;" onclick="Admin.deleteSong(${s.id})">🗑</button>
        </div>
      </div>`).join('');
    }

    async function editSong(id) {
        const song = await CMS.Songs.get(id);
        if (song) showSongForm(song);
    }

    async function deleteSong(id) {
        if (!confirm('Delete this song?')) return;
        await CMS.Songs.delete(id); toast('Song deleted'); loadSongs(); loadDashboard();
    }

    // ─────────────────────────────────────────────────
    //  IMAGES
    // ─────────────────────────────────────────────────
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
        fc.style.display = 'block'; fc.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('image-form-title').textContent = img ? '✏ Edit Image' : '🖼 Upload Image';
        document.getElementById('if-title').value = img?.title || '';
        document.getElementById('if-category').value = img?.category || '';
        document.getElementById('if-desc').value = img?.description || '';
        document.getElementById('if-tags').value = img?.tags || '';
        document.getElementById('if-edit-id').value = img?.id || '';
        clearFileInput('if-file', 'img-preview');
        if (img?.file) document.getElementById('img-preview').innerHTML = `<img src="${img.file}" style="max-height:100px;">`;
    }

    function resetImageForm() {
        ['if-title', 'if-category', 'if-desc', 'if-tags', 'if-edit-id'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        clearFileInput('if-file', 'img-preview');
    }

    async function saveImage() {
        const title = document.getElementById('if-title').value.trim();
        const fileInput = document.getElementById('if-file');
        const editId = document.getElementById('if-edit-id').value;
        if (!title) { toast('Image title is required', 'error'); return; }

        const btn = document.getElementById('save-image-btn');
        btn.disabled = true; btn.textContent = '⏳ Saving...';

        try {
            const base = {
                title, category: document.getElementById('if-category').value.trim(),
                description: document.getElementById('if-desc').value.trim(),
                tags: document.getElementById('if-tags').value.trim(),
            };

            if (editId && !fileInput.files.length) {
                const existing = await CMS.Images.get(Number(editId));
                await CMS.Images.update({ ...base, id: Number(editId), createdAt: existing.createdAt, file: existing.file });
                toast('Image updated!');
            } else {
                if (!fileInput.files.length) { toast('Please select an image file', 'error'); btn.disabled = false; btn.textContent = '💾 Save Image(s)'; return; }
                // Support multiple images
                for (const file of fileInput.files) {
                    const imgData = await CMS.fileToBase64(file);
                    await CMS.Images.add({ ...base, title: fileInput.files.length > 1 ? file.name.replace(/\.[^.]+$/, '') : title, file: imgData });
                }
                toast(`${fileInput.files.length} image(s) saved!`);
            }

            document.getElementById('image-form-card').style.display = 'none';
            resetImageForm(); loadImages();
        } catch (err) { toast('Error: ' + err.message, 'error'); }
        btn.disabled = false; btn.textContent = '💾 Save Image(s)';
    }

    async function loadImages() {
        const list = document.getElementById('images-list');
        const imgs = await CMS.Images.getAll();
        if (!imgs.length) { list.innerHTML = '<div class="empty"><div class="e-icon">🖼</div><p>No images yet.</p></div>'; return; }
        list.innerHTML = imgs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(img => `
      <div class="content-item">
        ${img.file ? `<img class="ci-thumb" src="${img.file}" alt="">` : `<div class="ci-thumb-ph">🖼</div>`}
        <div class="ci-info">
          <div class="name">${esc(img.title)}</div>
          <div class="sub">${esc(img.category || '')} · ${fmtDate(img.createdAt)}</div>
        </div>
        <div class="ci-actions">
          <button class="btn btn-ghost" style="font-size:0.78rem;" onclick="Admin.editImage(${img.id})">✏ Edit</button>
          <button class="btn btn-danger" style="font-size:0.78rem;" onclick="Admin.deleteImage(${img.id})">🗑</button>
        </div>
      </div>`).join('');
    }

    async function editImage(id) { const img = await CMS.Images.get(id); if (img) showImageForm(img); }
    async function deleteImage(id) { if (!confirm('Delete this image?')) return; await CMS.Images.delete(id); toast('Image deleted'); loadImages(); loadDashboard(); }

    // ─────────────────────────────────────────────────
    //  VIDEOS
    // ─────────────────────────────────────────────────
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
        fc.style.display = 'block'; fc.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('video-form-title').textContent = vid ? '✏ Edit Video' : '🎬 Upload Video';
        document.getElementById('vf-title').value = vid?.title || '';
        document.getElementById('vf-desc').value = vid?.description || '';
        document.getElementById('vf-tags').value = vid?.tags || '';
        document.getElementById('vf-edit-id').value = vid?.id || '';
        clearFileInput('vf-file', 'vid-preview');
        clearFileInput('vf-thumb', 'thumb-preview');
        if (vid?.thumbnail) document.getElementById('thumb-preview').innerHTML = `<img src="${vid.thumbnail}" style="max-height:80px;">`;
    }

    function resetVideoForm() {
        ['vf-title', 'vf-desc', 'vf-tags', 'vf-edit-id'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        clearFileInput('vf-file', 'vid-preview');
        clearFileInput('vf-thumb', 'thumb-preview');
    }

    async function saveVideo() {
        const title = document.getElementById('vf-title').value.trim();
        const fileInput = document.getElementById('vf-file');
        const thumbInput = document.getElementById('vf-thumb');
        const editId = document.getElementById('vf-edit-id').value;
        if (!title) { toast('Video title is required', 'error'); return; }

        const btn = document.getElementById('save-video-btn');
        btn.disabled = true; btn.textContent = '⏳ Saving...';
        try {
            const base = { title, description: document.getElementById('vf-desc').value.trim(), tags: document.getElementById('vf-tags').value.trim() };
            let file = null, thumbnail = null;
            if (fileInput.files[0]) file = await CMS.fileToBase64(fileInput.files[0]);
            if (thumbInput.files[0]) thumbnail = await CMS.fileToBase64(thumbInput.files[0]);

            if (editId) {
                const existing = await CMS.Videos.get(Number(editId));
                await CMS.Videos.update({ ...base, id: Number(editId), createdAt: existing.createdAt, file: file || existing.file, thumbnail: thumbnail || existing.thumbnail });
                toast('Video updated!');
            } else {
                if (!file) { toast('Please select a video file', 'error'); btn.disabled = false; btn.textContent = '💾 Save Video'; return; }
                await CMS.Videos.add({ ...base, file, thumbnail });
                toast('Video saved!');
            }
            document.getElementById('video-form-card').style.display = 'none';
            resetVideoForm(); loadVideos();
        } catch (err) { toast('Error: ' + err.message, 'error'); }
        btn.disabled = false; btn.textContent = '💾 Save Video';
    }

    async function loadVideos() {
        const list = document.getElementById('videos-list');
        const vids = await CMS.Videos.getAll();
        if (!vids.length) { list.innerHTML = '<div class="empty"><div class="e-icon">🎬</div><p>No videos yet.</p></div>'; return; }
        list.innerHTML = vids.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(v => `
      <div class="content-item">
        ${v.thumbnail ? `<img class="ci-thumb" src="${v.thumbnail}" alt="">` : `<div class="ci-thumb-ph">🎬</div>`}
        <div class="ci-info">
          <div class="name">${esc(v.title)}</div>
          <div class="sub">${fmtDate(v.createdAt)}${v.tags ? ' · ' + esc(v.tags) : ''}</div>
        </div>
        <div class="ci-actions">
          <button class="btn btn-ghost" style="font-size:0.78rem;" onclick="Admin.editVideo(${v.id})">✏ Edit</button>
          <button class="btn btn-danger" style="font-size:0.78rem;" onclick="Admin.deleteVideo(${v.id})">🗑</button>
        </div>
      </div>`).join('');
    }

    async function editVideo(id) { const v = await CMS.Videos.get(id); if (v) showVideoForm(v); }
    async function deleteVideo(id) { if (!confirm('Delete this video?')) return; await CMS.Videos.delete(id); toast('Video deleted'); loadVideos(); loadDashboard(); }

    // ─────────────────────────────────────────────────
    //  ARTICLES
    // ─────────────────────────────────────────────────
    function setupArticlesPanel() {
        document.getElementById('add-article-btn').addEventListener('click', () => showArticleForm());
        document.getElementById('save-article-btn').addEventListener('click', saveArticle);
        document.getElementById('cancel-article-btn').addEventListener('click', () => {
            document.getElementById('article-form-card').style.display = 'none';
            resetArticleForm();
        });

        // Placeholder behavior for contenteditable
        const editor = document.getElementById('af-body');
        editor?.addEventListener('focus', () => { if (editor.textContent === '') editor.classList.add('focused'); });
        editor?.addEventListener('blur', () => editor.classList.remove('focused'));
    }

    function showArticleForm(art = null) {
        const fc = document.getElementById('article-form-card');
        fc.style.display = 'block'; fc.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('article-form-title').textContent = art ? '✏ Edit Article' : '📰 Write Article';
        document.getElementById('af-title').value = art?.title || '';
        document.getElementById('af-tags').value = art?.tags || '';
        document.getElementById('af-body').innerHTML = art?.body || '';
        document.getElementById('af-edit-id').value = art?.id || '';
        clearFileInput('af-cover', 'artcover-preview');
        if (art?.cover) document.getElementById('artcover-preview').innerHTML = `<img src="${art.cover}" style="max-height:80px;">`;
    }

    function resetArticleForm() {
        ['af-title', 'af-tags', 'af-edit-id'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        document.getElementById('af-body').innerHTML = '';
        clearFileInput('af-cover', 'artcover-preview');
    }

    async function saveArticle() {
        const title = document.getElementById('af-title').value.trim();
        const body = document.getElementById('af-body').innerHTML.trim();
        const editId = document.getElementById('af-edit-id').value;
        if (!title) { toast('Article title is required', 'error'); return; }
        if (!body || body === '<br>') { toast('Please write some content', 'error'); return; }

        const btn = document.getElementById('save-article-btn');
        btn.disabled = true; btn.textContent = '⏳ Saving...';
        try {
            const coverInput = document.getElementById('af-cover');
            let cover = null;
            if (coverInput.files[0]) cover = await CMS.fileToBase64(coverInput.files[0]);

            const data = { title, body, tags: document.getElementById('af-tags').value.trim() };
            if (cover) data.cover = cover;

            if (editId) {
                const existing = await CMS.Articles.get(Number(editId));
                data.id = Number(editId); data.createdAt = existing.createdAt;
                if (!cover && existing.cover) data.cover = existing.cover;
                await CMS.Articles.update(data); toast('Article updated!');
            } else {
                await CMS.Articles.add(data); toast('Article published!');
            }
            document.getElementById('article-form-card').style.display = 'none';
            resetArticleForm(); loadArticles();
        } catch (err) { toast('Error: ' + err.message, 'error'); }
        btn.disabled = false; btn.textContent = '💾 Save Article';
    }

    async function loadArticles() {
        const list = document.getElementById('articles-list');
        const arts = await CMS.Articles.getAll();
        if (!arts.length) { list.innerHTML = '<div class="empty"><div class="e-icon">📰</div><p>No articles yet.</p></div>'; return; }
        list.innerHTML = arts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(a => `
      <div class="content-item">
        ${a.cover ? `<img class="ci-thumb" src="${a.cover}" alt="">` : `<div class="ci-thumb-ph">📰</div>`}
        <div class="ci-info">
          <div class="name">${esc(a.title)}</div>
          <div class="sub">${fmtDate(a.createdAt)}${a.tags ? ' · ' + esc(a.tags) : ''}</div>
        </div>
        <div class="ci-actions">
          <button class="btn btn-ghost" style="font-size:0.78rem;" onclick="Admin.editArticle(${a.id})">✏ Edit</button>
          <button class="btn btn-danger" style="font-size:0.78rem;" onclick="Admin.deleteArticle(${a.id})">🗑</button>
        </div>
      </div>`).join('');
    }

    async function editArticle(id) { const a = await CMS.Articles.get(id); if (a) showArticleForm(a); }
    async function deleteArticle(id) { if (!confirm('Delete this article?')) return; await CMS.Articles.delete(id); toast('Article deleted'); loadArticles(); loadDashboard(); }

    // ── Public API ────────────────────────────────────
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
