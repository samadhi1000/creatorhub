// ========================================================
//  app.js — Creator CMS Frontend Logic
// ========================================================

const App = (() => {
    // ── State ─────────────────────────────────────────────
    let currentSong = null;
    let currentSongId = null;
    let audioEl = new Audio();
    let isPlaying = false;
    let allSongs = [];
    let allImages = [];
    let allVideos = [];
    let allArticles = [];
    let progressRafId = null;

    // ── DOM refs ──────────────────────────────────────────
    const $ = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => [...c.querySelectorAll(s)];

    // ── Formatters ────────────────────────────────────────
    function fmtTime(sec) {
        if (!isFinite(sec)) return '0:00';
        const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
    function fmtDate(ts) {
        if (!ts) return '';
        return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    function stripHtml(html) { const d = document.createElement('div'); d.innerHTML = html; return d.textContent || ''; }

    // ========================================================
    //  HERO CANVAS — Particle System
    // ========================================================
    function initHeroCanvas() {
        const canvas = document.getElementById('hero-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let W, H, particles = [];

        function resize() { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }
        resize();
        window.addEventListener('resize', resize);

        class Particle {
            constructor() { this.reset(); }
            reset() {
                this.x = Math.random() * W; this.y = Math.random() * H;
                this.vx = (Math.random() - 0.5) * 0.4; this.vy = (Math.random() - 0.5) * 0.4;
                this.r = Math.random() * 2.5 + 0.5;
                this.alpha = Math.random() * 0.5 + 0.2;
                this.color = Math.random() > 0.5 ? '124,58,237' : '6,182,212';
            }
            update() {
                this.x += this.vx; this.y += this.vy;
                if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${this.color},${this.alpha})`;
                ctx.fill();
            }
        }

        for (let i = 0; i < 120; i++) particles.push(new Particle());

        // Connection lines
        function drawConnections() {
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(124,58,237,${0.08 * (1 - dist / 120)})`;
                        ctx.lineWidth = 0.6;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }
        }

        // Mouse parallax
        let mx = W / 2, my = H / 2;
        canvas.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

        function loop() {
            ctx.clearRect(0, 0, W, H);
            // Subtle radial gradient at mouse
            const grd = ctx.createRadialGradient(mx, my, 0, mx, my, 300);
            grd.addColorStop(0, 'rgba(124,58,237,0.07)'); grd.addColorStop(1, 'transparent');
            ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
            drawConnections();
            particles.forEach(p => { p.update(); p.draw(); });
            requestAnimationFrame(loop);
        }
        loop();
    }

    // ========================================================
    //  VANILLA TILT — 3D Cards
    // ========================================================
    function initTilt(parentSelector) {
        const cards = $$(parentSelector + ' .glass-card');
        cards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;
                card.style.transform = `perspective(800px) rotateY(${x * 14}deg) rotateX(${-y * 12}deg) translateY(-4px)`;
                card.style.boxShadow = `${-x * 20}px ${-y * 20}px 50px rgba(124,58,237,0.2), 0 16px 50px rgba(0,0,0,0.5)`;
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
                card.style.boxShadow = '';
            });
        });
    }

    // ========================================================
    //  MUSIC PLAYER
    // ========================================================
    function openPlayer(song) {
        currentSong = song;
        currentSongId = song.id;

        // Update player UI
        const player = document.getElementById('music-player');
        const titleEl = player.querySelector('.player-title');
        const artistEl = player.querySelector('.player-artist');
        const coverEl = player.querySelector('.player-cover');
        const coverPh = player.querySelector('.player-cover-placeholder');

        titleEl.textContent = song.title || 'Unknown';
        artistEl.textContent = song.artist || '';

        if (song.cover) {
            coverEl.src = song.cover; coverEl.style.display = 'block';
            coverPh.style.display = 'none';
        } else {
            coverEl.style.display = 'none';
            coverPh.style.display = 'flex';
        }

        // Load & play
        audioEl.src = song.mp3;
        audioEl.play().catch(() => { });
        isPlaying = true;
        updatePlayBtn();

        player.classList.add('visible');
        trackProgress();
    }

    function updatePlayBtn() {
        const btn = document.querySelector('.player-btn.play-pause');
        if (btn) btn.textContent = isPlaying ? '⏸' : '▶';
    }

    function trackProgress() {
        const bar = document.getElementById('player-progress');
        const curr = document.getElementById('player-current');
        const dur = document.getElementById('player-duration');
        if (!bar) return;
        if (progressRafId) cancelAnimationFrame(progressRafId);

        function update() {
            if (!audioEl.paused) {
                const pct = audioEl.duration ? (audioEl.currentTime / audioEl.duration) * 100 : 0;
                bar.value = pct;
                if (curr) curr.textContent = fmtTime(audioEl.currentTime);
                if (dur) dur.textContent = fmtTime(audioEl.duration);
            }
            progressRafId = requestAnimationFrame(update);
        }
        update();
    }

    function initMusicPlayer() {
        const player = document.getElementById('music-player');
        const playPauseBtn = player.querySelector('.player-btn.play-pause');
        const progressBar = document.getElementById('player-progress');
        const volSlider = document.getElementById('player-volume');
        const closeBtn = player.querySelector('.player-close');
        const lyricsBtn = player.querySelector('.player-lyrics-btn');

        playPauseBtn?.addEventListener('click', () => {
            isPlaying ? audioEl.pause() : audioEl.play();
            isPlaying = !isPlaying;
            updatePlayBtn();
        });

        progressBar?.addEventListener('input', () => {
            audioEl.currentTime = (progressBar.value / 100) * audioEl.duration;
        });

        volSlider?.addEventListener('input', () => {
            audioEl.volume = volSlider.value / 100;
        });

        closeBtn?.addEventListener('click', () => {
            audioEl.pause(); isPlaying = false;
            player.classList.remove('visible');
        });

        lyricsBtn?.addEventListener('click', () => {
            if (currentSong) openLyricsModal(currentSong);
        });

        audioEl.addEventListener('ended', () => {
            isPlaying = false; updatePlayBtn();
            // Auto-play next
            const idx = allSongs.findIndex(s => s.id === currentSongId);
            if (idx !== -1 && idx < allSongs.length - 1) openPlayer(allSongs[idx + 1]);
        });
    }

    // ========================================================
    //  MODALS
    // ========================================================
    function openModal(id) { document.getElementById(id)?.classList.add('open'); }
    function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

    function closeAllModals() {
        $$('.modal-overlay').forEach(m => m.classList.remove('open'));
    }

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllModals(); });

    // Lyrics Modal
    function openLyricsModal(song) {
        const title = document.getElementById('lyrics-title');
        const artist = document.getElementById('lyrics-artist');
        const content = document.getElementById('lyrics-content');
        if (title) title.textContent = song.title || '';
        if (artist) artist.textContent = song.artist || '';
        if (content) content.textContent = song.lyrics || 'No lyrics available.';
        openModal('lyrics-modal');
    }

    // Lightbox
    function openLightbox(src, caption) {
        const overlay = document.getElementById('lightbox');
        const img = overlay?.querySelector('img');
        const cap = overlay?.querySelector('.lb-caption');
        if (img) img.src = src;
        if (cap) cap.textContent = caption || '';
        overlay?.classList.add('open');
    }

    // Video Modal
    function openVideoModal(video) {
        const title = document.getElementById('video-modal-title');
        const videoEl = document.getElementById('video-modal-video');
        const desc = document.getElementById('video-modal-desc');
        if (title) title.textContent = video.title || '';
        if (videoEl) { videoEl.src = video.file; videoEl.load(); }
        if (desc) desc.textContent = video.description || '';
        openModal('video-modal');
    }

    // Article Modal
    function openArticleModal(article) {
        const title = document.getElementById('article-modal-title');
        const cover = document.getElementById('article-modal-cover');
        const date = document.getElementById('article-modal-date');
        const body = document.getElementById('article-modal-body');
        if (title) title.textContent = article.title || '';
        if (cover) { cover.src = article.cover || ''; cover.style.display = article.cover ? 'block' : 'none'; }
        if (date) date.textContent = fmtDate(article.created_at || article.createdAt);
        if (body) body.innerHTML = article.body || '';
        openModal('article-modal');
    }

    // ========================================================
    //  RENDER: SONGS
    // ========================================================
    function renderSongs(songs) {
        allSongs = songs;
        const grid = document.getElementById('songs-grid');
        if (!grid) return;
        if (!songs.length) { grid.innerHTML = emptyState('🎵', 'No Songs Yet', 'Upload songs from the admin panel.'); return; }

        grid.innerHTML = songs.map(song => `
      <div class="glass-card song-card animate-on-scroll" data-id="${song.id}">
        <div class="cover-wrap">
          ${song.cover
                ? `<img src="${song.cover}" alt="${escHtml(song.title)}" class="cover-img" loading="lazy">`
                : `<div class="cover-img" style="background:linear-gradient(135deg,#7c3aed,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:3rem;aspect-ratio:1;">🎵</div>`
            }
          <div class="cover-overlay">
            <button class="play-btn-circle" onclick="App.playSong(${song.id})">▶</button>
          </div>
        </div>
        <div class="card-info">
          <div class="song-title">${escHtml(song.title || 'Untitled')}</div>
          <div class="song-artist">${escHtml(song.artist || '')}</div>
          ${song.genre ? `<div class="song-tags"><span class="tag">${escHtml(song.genre)}</span></div>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn-sm" onclick="App.playSong(${song.id})">▶ Play</button>
          ${song.lyrics ? `<button class="btn-sm lyrics" onclick="App.openLyrics(${song.id})">📃 Lyrics</button>` : ''}
        </div>
      </div>
    `).join('');

        initScrollAnimations('#songs-grid');
        initTilt('#songs-section');
    }

    // ========================================================
    //  RENDER: IMAGES
    // ========================================================
    function renderImages(images) {
        allImages = images;
        const grid = document.getElementById('gallery-grid');
        if (!grid) return;
        if (!images.length) { grid.innerHTML = emptyState('🖼', 'No Images Yet', 'Upload images from the admin panel.'); return; }

        grid.innerHTML = images.map(img => `
      <div class="glass-card image-card animate-on-scroll" onclick="App.viewImage(${img.id})">
        <div class="img-wrap">
          <img src="${img.file}" alt="${escHtml(img.title)}" loading="lazy">
          <div class="img-overlay">
            <div style="color:#fff;font-size:1.5rem;">🔍 View</div>
          </div>
        </div>
        <div class="img-info">
          <div class="img-title">${escHtml(img.title || 'Image')}</div>
          ${img.category ? `<div class="img-cat">${escHtml(img.category)}</div>` : ''}
        </div>
      </div>
    `).join('');

        initScrollAnimations('#gallery-grid');
        initTilt('#gallery-section');
    }

    // ========================================================
    //  RENDER: VIDEOS
    // ========================================================
    function renderVideos(videos) {
        allVideos = videos;
        const grid = document.getElementById('videos-grid');
        if (!grid) return;
        if (!videos.length) { grid.innerHTML = emptyState('🎬', 'No Videos Yet', 'Upload videos from the admin panel.'); return; }

        grid.innerHTML = videos.map(vid => `
      <div class="glass-card video-card animate-on-scroll" onclick="App.playVideo(${vid.id})">
        <div class="vid-thumb">
          ${vid.thumbnail
                ? `<img src="${vid.thumbnail}" alt="${escHtml(vid.title)}" loading="lazy">`
                : `<div style="width:100%;aspect-ratio:16/9;background:linear-gradient(135deg,#120820,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:3rem;">🎬</div>`
            }
          <div class="play-overlay">
            <div class="play-icon">▶</div>
          </div>
        </div>
        <div class="vid-info">
          <div class="vid-title">${escHtml(vid.title || 'Video')}</div>
          ${vid.description ? `<div class="vid-desc">${escHtml(vid.description)}</div>` : ''}
        </div>
      </div>
    `).join('');

        initScrollAnimations('#videos-grid');
        initTilt('#videos-section');
    }

    // ========================================================
    //  RENDER: ARTICLES
    // ========================================================
    function renderArticles(articles) {
        allArticles = articles;
        const grid = document.getElementById('articles-grid');
        if (!grid) return;
        if (!articles.length) { grid.innerHTML = emptyState('📰', 'No Articles Yet', 'Write articles from the admin panel.'); return; }

        grid.innerHTML = articles.map(art => `
      <div class="glass-card article-card animate-on-scroll" onclick="App.readArticle(${art.id})">
        ${art.cover
                ? `<div class="art-cover"><img src="${art.cover}" alt="${escHtml(art.title)}" loading="lazy"></div>`
                : `<div class="art-cover" style="background:linear-gradient(135deg,#0a0a1e,#1a1020);display:flex;align-items:center;justify-content:center;font-size:3rem;aspect-ratio:16/7;">📰</div>`
            }
        <div class="art-body">
          <div class="art-meta">
            <span class="art-date">${fmtDate(art.created_at || art.createdAt)}</span>
            ${art.tags ? `<span class="art-tag">${escHtml(art.tags.split(',')[0].trim())}</span>` : ''}
          </div>
          <div class="art-title">${escHtml(art.title || 'Untitled')}</div>
          <div class="art-excerpt">${escHtml(stripHtml(art.body || ''))}</div>
          <div class="art-read-more">Read more →</div>
        </div>
      </div>
    `).join('');

        initScrollAnimations('#articles-grid');
        initTilt('#articles-section');
    }

    // ========================================================
    //  SCROLL ANIMATIONS
    // ========================================================
    function initScrollAnimations(parentSel) {
        const items = $$(parentSel ? `${parentSel} .animate-on-scroll` : '.animate-on-scroll');
        const obs = new IntersectionObserver((entries) => {
            entries.forEach((entry, i) => {
                if (entry.isIntersecting) {
                    setTimeout(() => entry.target.classList.add('visible'), i * 80);
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        items.forEach(el => obs.observe(el));
    }

    // ========================================================
    //  HERO STATS (live counts)
    // ========================================================
    async function updateHeroStats() {
        const counts = await CMS.getCounts();
        const songCount = document.getElementById('stat-songs');
        const imgCount = document.getElementById('stat-images');
        const vidCount = document.getElementById('stat-videos');
        const artCount = document.getElementById('stat-articles');
        if (songCount) animateCount(songCount, counts.songs);
        if (imgCount) animateCount(imgCount, counts.images);
        if (vidCount) animateCount(vidCount, counts.videos);
        if (artCount) animateCount(artCount, counts.articles);
    }

    function animateCount(el, target) {
        let cur = 0;
        const step = Math.ceil(target / 40);
        const t = setInterval(() => {
            cur = Math.min(cur + step, target);
            el.textContent = cur;
            if (cur >= target) clearInterval(t);
        }, 30);
    }

    // ========================================================
    //  SEARCH
    // ========================================================
    function initSearch() {
        const searchBtn = document.getElementById('search-btn');
        const overlay = document.getElementById('search-overlay');
        const input = document.getElementById('search-input');
        const closeBtn = document.getElementById('search-close-btn');
        const resultsEl = document.getElementById('search-results');

        searchBtn?.addEventListener('click', () => overlay.classList.add('open'));
        closeBtn?.addEventListener('click', () => overlay.classList.remove('open'));
        overlay?.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });

        let debounceTimer;
        input?.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => performSearch(input.value, resultsEl), 300);
        });
    }

    async function performSearch(query, resultsEl) {
        if (!query.trim()) { resultsEl.innerHTML = ''; return; }
        resultsEl.innerHTML = '<div class="spinner"></div>';
        const results = await CMS.searchAll(query);

        let html = '';
        if (results.songs.length) {
            html += `<div class="search-section-title">🎵 Songs (${results.songs.length})</div>`;
            html += results.songs.map(s => searchResultItem(s, 'song')).join('');
        }
        if (results.images.length) {
            html += `<div class="search-section-title">🖼 Images (${results.images.length})</div>`;
            html += results.images.map(i => searchResultItem(i, 'image')).join('');
        }
        if (results.videos.length) {
            html += `<div class="search-section-title">🎬 Videos (${results.videos.length})</div>`;
            html += results.videos.map(v => searchResultItem(v, 'video')).join('');
        }
        if (results.articles.length) {
            html += `<div class="search-section-title">📰 Articles (${results.articles.length})</div>`;
            html += results.articles.map(a => searchResultItem(a, 'article')).join('');
        }
        if (!html) html = '<div style="text-align:center;color:var(--text-muted);padding:2rem;">No results found</div>';
        resultsEl.innerHTML = html;

        // Bind click events
        $$('.search-result-item', resultsEl).forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type, id = Number(item.dataset.id);
                document.getElementById('search-overlay').classList.remove('open');
                if (type === 'song') App.playSong(id);
                if (type === 'image') App.viewImage(id);
                if (type === 'video') App.playVideo(id);
                if (type === 'article') App.readArticle(id);
            });
        });
    }

    function searchResultItem(item, type) {
        const icons = { song: '🎵', image: '🖼', video: '🎬', article: '📰' };
        const badge = { song: 'badge-song', image: 'badge-image', video: 'badge-video', article: 'badge-article' };
        const thumb = item.cover || item.file || item.thumbnail;
        return `
      <div class="search-result-item" data-type="${type}" data-id="${item.id}">
        ${thumb
                ? `<img class="search-result-thumb" src="${thumb}" alt="" loading="lazy">`
                : `<div class="search-result-thumb placeholder">${icons[type]}</div>`
            }
        <div class="search-result-info">
          <div class="name">${escHtml(item.title || 'Untitled')}</div>
          <div class="meta">${escHtml(item.artist || item.category || item.description || '').substring(0, 40)}</div>
        </div>
        <span class="search-type-badge ${badge[type]}">${type}</span>
      </div>`;
    }

    // ========================================================
    //  NAV
    // ========================================================
    function initNav() {
        const hamburger = document.getElementById('hamburger');
        const navLinks = document.querySelector('.nav-links');
        hamburger?.addEventListener('click', () => navLinks.classList.toggle('open'));

        // Active section highlight
        const sections = $$('.snap-section');
        const links = $$('.nav-links a');
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    links.forEach(l => l.classList.remove('active'));
                    const match = links.find(l => l.getAttribute('href') === `#${entry.target.id}`);
                    if (match) match.classList.add('active');
                }
            });
        }, { threshold: 0.55 });
        sections.forEach(s => obs.observe(s));
    }

    // ========================================================
    //  UTILITIES
    // ========================================================
    function escHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function emptyState(icon, title, msg) {
        return `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${msg}</p></div>`;
    }

    // ========================================================
    //  PUBLIC API — uses Supabase normalized data
    // ========================================================
    async function playSong(id) {
        let song = allSongs.find(s => s.id === id);
        if (!song) song = await CMS.NormSongs.get(id);
        if (song) openPlayer(song);
    }

    async function openLyrics(id) {
        let song = allSongs.find(s => s.id === id);
        if (!song) song = await CMS.NormSongs.get(id);
        if (song) openLyricsModal(song);
    }

    async function viewImage(id) {
        let img = allImages.find(i => i.id === id);
        if (!img) img = await CMS.NormImages.get(id);
        if (img) openLightbox(img.file, img.title);
    }

    async function playVideo(id) {
        let vid = allVideos.find(v => v.id === id);
        if (!vid) vid = await CMS.NormVideos.get(id);
        if (vid) openVideoModal(vid);
    }

    async function readArticle(id) {
        let art = allArticles.find(a => a.id === id);
        if (!art) art = await CMS.NormArticles.get(id);
        if (art) openArticleModal(art);
    }

    // ========================================================
    //  INIT
    // ========================================================
    async function init() {
        // Show not-configured banner if Supabase not set up
        if (!window.IS_SUPABASE_CONFIGURED) {
            const banner = document.getElementById('setup-banner');
            if (banner) banner.style.display = 'flex';
        }

        // Load content from Supabase
        const [songs, images, videos, articles] = await Promise.all([
            CMS.NormSongs.getAll(),
            CMS.NormImages.getAll(),
            CMS.NormVideos.getAll(),
            CMS.NormArticles.getAll(),
        ]);

        renderSongs(songs);
        renderImages(images);
        renderVideos(videos);
        renderArticles(articles);
        updateHeroStats();
        initHeroCanvas();
        initMusicPlayer();
        initSearch();
        initNav();
        initScrollAnimations();

        // Close modal buttons
        $$('.modal-close, .modal-overlay').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target === el || el.classList.contains('modal-close')) {
                    const overlay = el.closest('.modal-overlay') || el;
                    overlay.classList.remove('open');
                    const vid = document.getElementById('video-modal-video');
                    if (vid) vid.pause();
                }
            });
        });

        // Lightbox close
        const lb = document.getElementById('lightbox');
        lb?.querySelector('.close-lb')?.addEventListener('click', () => lb.classList.remove('open'));
        lb?.addEventListener('click', (e) => { if (e.target === lb) lb.classList.remove('open'); });
    }

    return { init, playSong, openLyrics, viewImage, playVideo, readArticle };
})();

// Boot
document.addEventListener('DOMContentLoaded', App.init);
