<div align="center">

# 🗒️ AuthNote System 

**A full-stack, OWASP-hardened notes application with rich text editing, Google Sign-In, media attachments, and full-text search.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-notes--frontend--j8qo.onrender.com-4fc3f7?style=for-the-badge)](https://notes-frontend-j8qo.onrender.com)
[![GitHub](https://img.shields.io/badge/GitHub-Rememberful%2Fsecured--messaging-1c1b19?style=for-the-badge&logo=github)](https://github.com/Rememberful/secured-messaging)

</div>

---

## ✨ Features

### 🔐 Authentication
| Feature | Detail |
|---|---|
| Email / Password | bcrypt cost-12 hashing, zod-validated, emails normalized |
| Google Sign-In | Server-side token verification via `google-auth-library` |
| JWT Sessions | 7-day expiry with issuer + audience claim verification |
| Forgot Password | SHA-256 hashed reset tokens, 1-hour expiry, single-use, email via Resend |
| Session Timeout | Fixed 1-hour session from login — 60s warning modal before auto-logout |

### 📝 Notes
| Feature | Detail |
|---|---|
| CRUD | Create, read, update, delete — all scoped per user |
| Rich Text Editor | Tiptap-based WYSIWYG — Bold, Italic, Underline, Strikethrough, H1/H2, Bullet & Numbered lists, Inline code, Code block, Blockquote, Links, Undo/Redo |
| Auto-save | 3-second debounce — drafts saved automatically, flushed on window close and sign-out |
| Note Preview | Cards show first 20 words; full content opens in a modal overlay |
| Full-Text Search | Postgres `tsvector` + `GIN` index, `websearch_to_tsquery`, relevance ranking, stemming |
| Tags | Many-to-many schema, per-user namespace, chip-style input, filter bar with counts |
| Media Attachments | JPEG/PNG/GIF/WebP up to 2MB — magic-byte validated, stored as `bytea` in Postgres |

### 🛡️ Security (OWASP Top 10 + API Security Top 10)
| Control | Implementation |
|---|---|
| Rate Limiting | 10 login attempts / 15 min · 10 signups / hour · 300 general / 15 min |
| Security Headers | `helmet` — HSTS, X-Content-Type-Options, X-Frame-Options, CSP |
| Input Validation | `zod` schemas on every request body — acts as explicit field allowlist |
| Mass Assignment | `req.body` never spread into queries — injected fields silently ignored |
| File Upload | Magic-byte validation — Content-Type header is not trusted |
| Ownership Checks | Every note and media operation verifies `user_id` matches authenticated user |
| Email Normalization | Trimmed + lowercased before every signup/login/lookup |
| Trust Proxy | Correct IP attribution behind Render's load balancer |
| No SQL Injection | Parameterized queries everywhere, numeric ID guards on route params |

### 🎨 UI / UX
- **Light / Dark / System** theme toggle — persists in `localStorage`, no flash on page load
- **Pure dark VSCode-style palette** — `#1e1e1e` background, `#d4d4d4` text, `#4fc3f7` accent
- **Backend wakeup banner** — polls `/api/health` on login page, shows progress bar while Render's free tier wakes up
- **Responsive** — mobile-friendly, bottom-sheet modal on small screens
- **Notepad favicon** — custom SVG, matches the app's aesthetic

---

## 🗂️ Project Structure

```
secured-messaging/
├── backend/
│   ├── src/
│   │   ├── db/db.js              # Postgres pool + initDb() — creates all tables on boot
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT requireAuth middleware
│   │   │   └── rateLimiters.js   # Auth + general rate limiters
│   │   ├── routes/
│   │   │   ├── auth.js           # signup, login, Google, forgot/reset password
│   │   │   ├── notes.js          # CRUD + full-text search + tag filtering
│   │   │   └── media.js          # Image upload, fetch, delete
│   │   ├── validation/
│   │   │   └── schemas.js        # Zod schemas for all request bodies
│   │   └── server.js             # Express app — helmet, CORS, rate limits, routes
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── public/
│   │   └── favicon.svg           # Custom notepad SVG favicon
│   ├── src/
│   │   ├── components/
│   │   │   ├── BackendWakeup.jsx # Polls /api/health, shows wakeup progress bar
│   │   │   ├── Composer.jsx      # New note form with RichEditor + auto-save
│   │   │   ├── Footer.jsx        # Developer contact footer
│   │   │   ├── GoogleSignInButton.jsx
│   │   │   ├── MediaGallery.jsx  # Upload/display/delete images (pending + attached modes)
│   │   │   ├── NoteCard.jsx      # View/edit/modal modes, 20-word preview
│   │   │   ├── NoteViewModal.jsx # Full note overlay with read-only RichEditor
│   │   │   ├── RichEditor.jsx    # Tiptap WYSIWYG with full toolbar
│   │   │   ├── SearchBar.jsx     # Debounced search input
│   │   │   ├── SessionWarningModal.jsx  # 60s countdown before auto-logout
│   │   │   ├── TagFilter.jsx     # Tag filter pills with note counts
│   │   │   ├── TagInput.jsx      # Chip-style tag editor
│   │   │   └── ThemeToggle.jsx   # Light/Dark/System cycle button
│   │   ├── context/
│   │   │   ├── AuthContext.jsx   # Token, user, login_time, logout
│   │   │   └── ThemeContext.jsx  # Theme mode, resolved value, OS listener
│   │   ├── hooks/
│   │   │   ├── useAutoSave.js    # Debounced save with flushSave()
│   │   │   └── useSessionTimeout.js  # 1-hour fixed session timer
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx     # Notes grid, search, tag filter, session timeout
│   │   │   ├── ForgotPassword.jsx
│   │   │   ├── Login.jsx         # With backend wakeup banner
│   │   │   └── Signup.jsx
│   │   ├── utils/
│   │   │   └── richText.js       # getPreviewText(), isRichContent()
│   │   ├── App.jsx               # Routes + Footer
│   │   ├── index.css             # Full design system — light + dark themes
│   │   └── main.jsx
│   ├── index.html                # Anti-flash theme script + Google GSI SDK
│   ├── vite.config.js            # Tiptap chunk splitting
│   └── package.json
└── render.yaml                   # Blueprint — deploys DB + backend + frontend together
```

---

## 🗄️ Database Schema

```sql
users               — id, email, name, password_hash, google_id, created_at
notes               — id, user_id, title, content (Tiptap JSON), search_vector (generated), created_at, updated_at
tags                — id, user_id, name  [UNIQUE per user]
note_tags           — note_id, tag_id   [composite PK, many-to-many]
media               — id, note_id, user_id, filename, mime_type, size_bytes, data (bytea), created_at
password_reset_tokens — id, user_id, token_hash, expires_at, used_at, created_at
```

`search_vector` is a `GENERATED ALWAYS AS ... STORED` column — Postgres keeps it in sync automatically on every insert/update. A `GIN` index makes search fast at scale.

---

## 🚀 Running Locally

### Prerequisites
- Node.js 18+
- A Postgres database (local or Render's external URL)

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID
npm run dev
# Runs on http://localhost:4000
# Tables are created automatically on first boot
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env — set VITE_API_URL, VITE_GOOGLE_CLIENT_ID
npm run dev
# Runs on http://localhost:5173
```

---

## ☁️ Deploying to Render

### One-click Blueprint deploy

1. Push this repo to GitHub
2. Render dashboard → **New → Blueprint** → select the repo
3. Render reads `render.yaml` and provisions:
   - `notes-db` — Postgres (free)
   - `notes-backend` — Node web service
   - `notes-frontend` — Static site
4. Fill in the env vars Render can't generate (`GOOGLE_CLIENT_ID`, `CLIENT_ORIGIN`, `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`)
5. After both services deploy, set:
   - `notes-backend` → `CLIENT_ORIGIN = https://notes-frontend-xxxx.onrender.com`
   - `notes-frontend` → `VITE_API_URL = https://notes-backend-xxxx.onrender.com/api`
6. Add your Render frontend URL to Google Cloud Console → Credentials → Authorized JavaScript origins

> **Free tier note:** The backend spins down after 15 minutes of inactivity. The login page shows a wakeup banner while it restarts (usually 30–60s).

> **Database expiry:** Render's free Postgres instances expire after 30 days unless upgraded to a paid tier.

---

## 🔑 Environment Variables

**`backend/.env`**

| Variable | Example | Required |
|---|---|---|
| `PORT` | `4000` | No (Render sets it) |
| `JWT_SECRET` | 64-char random hex | ✅ |
| `DATABASE_URL` | `postgres://user:pass@host:5432/db` | ✅ |
| `GOOGLE_CLIENT_ID` | `123-abc.apps.googleusercontent.com` | For Google Sign-In |
| `CLIENT_ORIGIN` | `https://notes-frontend-xxxx.onrender.com` | ✅ |
| `RESEND_API_KEY` | `re_xxxx` | For password reset emails |
| `FROM_EMAIL` | `onboarding@resend.dev` | For password reset emails |
| `FRONTEND_URL` | `https://notes-frontend-xxxx.onrender.com` | For password reset link |

**`frontend/.env`**

| Variable | Example | Required |
|---|---|---|
| `VITE_API_URL` | `https://notes-backend-xxxx.onrender.com/api` | ✅ |
| `VITE_GOOGLE_CLIENT_ID` | `123-abc.apps.googleusercontent.com` | For Google Sign-In |

---

## 📡 API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | — | Health check |
| POST | `/api/auth/signup` | — | Register with email + password |
| POST | `/api/auth/login` | — | Sign in |
| POST | `/api/auth/google` | — | Google Sign-In |
| GET | `/api/auth/me` | ✅ | Current user |
| POST | `/api/auth/forgot-password` | — | Request password reset |
| POST | `/api/auth/reset-password` | — | Complete password reset |
| GET | `/api/notes` | ✅ | List notes (`?q=search&tag=name`) |
| POST | `/api/notes` | ✅ | Create note |
| GET | `/api/notes/tags/all` | ✅ | All tags with counts |
| GET | `/api/notes/:id` | ✅ | Get one note |
| PUT | `/api/notes/:id` | ✅ | Update note |
| DELETE | `/api/notes/:id` | ✅ | Delete note + cascade |
| POST | `/api/notes/:noteId/media` | ✅ | Upload image (multipart, field: `file`) |
| GET | `/api/media/:id` | ✅ | Fetch image bytes |
| DELETE | `/api/media/:id` | ✅ | Delete image |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, PostgreSQL (`pg`), JWT, bcrypt, Zod, Helmet, express-rate-limit, Multer, google-auth-library, Resend |
| Frontend | React 18, Vite, React Router, Tiptap (rich text), CSS variables |
| Database | PostgreSQL (Render managed), `tsvector` full-text search, `GIN` index, `bytea` media storage |
| Deploy | Render (Blueprint YAML), static site + web service + managed Postgres |

---

## 🔮 Planned Features

- **Messaging** — the repo is named `secured-messaging` ahead of this; no messaging exists yet
- **JWT revocation** — currently logout just discards the local token; a server-side denylist would close this gap
- **Object storage for media** — move from `bytea`-in-Postgres to S3/Cloudflare R2 for scale
- **Resend domain verification** — currently using `onboarding@resend.dev` sandbox sender

---

## 👨‍💻 Developer

**Aditya Kumar**

| | |
|---|---|
| 📧 Email | [adii.utsav@gmail.com](mailto:adii.utsav@gmail.com) |
| 📱 Phone | [+91 70794 87671](tel:+917079487671) |
| 💼 LinkedIn | [aditya-kumar-3241b6286](https://www.linkedin.com/in/aditya-kumar-3241b6286/) |
| 🐙 GitHub | [Rememberful](https://github.com/Rememberful) |
| ✍️ Medium | [@adii.utsav](https://medium.com/@adii.utsav) |
| 🤝 Contribute | [Secured-notetaking](https://github.com/Rememberful/Secured-notetaking) |

---

<div align="center">

Built with ☕ by Aditya Kumar

</div>