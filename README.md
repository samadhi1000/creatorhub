# 🎵 CreatorHub — Creator Portfolio CMS

A premium creator portfolio website with a WordPress-style admin panel. Built with pure HTML/CSS/JavaScript, powered by **Supabase** (storage + database) and deployed on **GitHub Pages**.

---

## ✅ Features

- 5 scroll-snap sections: Hero · Songs · Gallery · Videos · Articles
- Sticky MP3 player with lyrics popup
- Image lightbox, video popup player, article reader
- Cross-content search overlay
- Interactive particle canvas + 3D card hover effects
- Admin panel (login protected) with drag-and-drop file uploads

---

## 🚀 Setup Guide

### Step 1 — Supabase Setup

1. Go to [supabase.com](https://supabase.com) → Create a free project
2. In your project, go to **SQL Editor** and run:

```sql
create table songs (
  id bigint primary key generated always as identity,
  title text not null, artist text, genre text, tags text, lyrics text,
  mp3_url text, cover_url text,
  created_at timestamptz default now()
);

create table images (
  id bigint primary key generated always as identity,
  title text not null, category text, description text, tags text,
  file_url text,
  created_at timestamptz default now()
);

create table videos (
  id bigint primary key generated always as identity,
  title text not null, description text, tags text,
  file_url text, thumbnail_url text,
  created_at timestamptz default now()
);

create table articles (
  id bigint primary key generated always as identity,
  title text not null, body text, tags text,
  cover_url text,
  created_at timestamptz default now()
);
```

3. Go to **Storage** → Create 4 public buckets: `songs`, `images`, `videos`, `covers`
4. For each bucket: click it → **Policies** → Add policy → Allow public reads (`SELECT`)

### Step 2 — Configure `config.js`

Open `config.js` and paste your keys from **Project → Settings → API**:

```js
const SUPABASE_URL      = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

### Step 3 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
# Create a repo on github.com first, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 4 — Enable GitHub Pages

In your GitHub repo: **Settings → Pages → Source → main branch → / (root)** → Save

Your site will be live at: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

---

## 🔑 Admin Panel

- URL: `yoursite.com/admin.html` (or `localhost:8888/admin.html` for local)
- **Username:** `admin`  
- **Password:** `admin123`
- **Service Role Key:** From Supabase → Settings → API → `service_role` key

> ⚠️ **Free tier file limit:** 50MB per file. Large videos over 50MB require a Supabase Pro plan ($25/month).

---

## 🗂 File Structure

| File | Purpose |
|---|---|
| `index.html` | Public-facing website |
| `admin.html` | Admin CMS panel |
| `config.js` | **Edit this** — your Supabase keys |
| `db.js` | Supabase client data layer |
| `app.js` | Frontend logic (public site) |
| `admin.js` | Admin panel logic |
| `style.css` | Global dark glassmorphism styles |

---

## 🛡 Changing Admin Password

Edit `admin.js` line with:
```js
const ADMIN_CREDS = { username: 'admin', password: 'YOUR_NEW_PASSWORD' };
```
