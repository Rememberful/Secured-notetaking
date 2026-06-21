# Notes — Full-Stack CRUD App with Google Sign-In

A simple notes app with email/password auth **and** "Sign in with Google."
Backend: Node/Express + SQLite (using Node's built-in `node:sqlite`, no native build step).
Frontend: React + Vite.

```
notes-app/
├── backend/    Express API (auth, notes CRUD)
└── frontend/   React app (login, signup, dashboard)
```

## 1. Requirements

- **Node.js 22.5+** (needed for the built-in `node:sqlite` module). Check with `node -v`.
- npm

## 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and set:
- `JWT_SECRET` — any long random string (e.g. run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `GOOGLE_CLIENT_ID` — see step 4 below. You can leave the placeholder for now and email/password auth will still work; the Google button just won't.

Start it:

```bash
npm run dev
```

Runs on **http://localhost:4000**. A `data.sqlite` file is created automatically on first run — that's your whole database, no separate install needed.

## 3. Frontend setup

In a new terminal:

```bash
cd frontend
npm install
cp .env.example .env
```

Open `.env` and set `VITE_GOOGLE_CLIENT_ID` to the same Client ID as the backend (step 4).

Start it:

```bash
npm run dev
```

Runs on **http://localhost:5173**. Open that in your browser.

## 4. Setting up Google Sign-In (one-time, ~5 minutes)

Google Sign-In requires an OAuth Client ID from your own Google account — this can't be pre-filled for you since it's tied to your project and domain.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a new project (or pick an existing one).
2. Go to **APIs & Services → OAuth consent screen**. Choose **External**, fill in app name + your email, save.
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
4. Application type: **Web application**.
5. Under **Authorized JavaScript origins**, add:
   ```
   http://localhost:5173
   ```
6. Click **Create**. Copy the **Client ID** (looks like `123456-abc.apps.googleusercontent.com`).
7. Paste it into **both**:
   - `backend/.env` → `GOOGLE_CLIENT_ID`
   - `frontend/.env` → `VITE_GOOGLE_CLIENT_ID`
8. Restart both servers.

The "Continue with Google" button will then appear and work on the login/signup pages. Until you do this, the app still works fully with email/password — the button area just shows a small notice instead.

> When you're ready to deploy this for real (not localhost), add your production URL to **Authorized JavaScript origins** in the same Credentials page.

## 5. How auth works

- **Email/password**: password is hashed with bcrypt before storage. Login issues a JWT (7-day expiry) that the frontend stores and sends as `Authorization: Bearer <token>`.
- **Google Sign-In**: the frontend renders Google's real button via Google Identity Services. On click, Google returns a signed ID token directly to the browser. The frontend sends that token to the backend, which **verifies it server-side** against Google's servers (`google-auth-library`) — the frontend never tells the backend who the user is; the backend confirms it. A user account is created or linked automatically by email.
- Every `/api/notes/*` route requires a valid JWT, and every query is scoped to `user_id` — one user can never see or edit another's notes.

## 6. CRUD endpoints

| Method | Path             | Description                  |
|--------|------------------|-------------------------------|
| POST   | /api/auth/signup | Email/password sign up        |
| POST   | /api/auth/login  | Email/password sign in        |
| POST   | /api/auth/google | Google Sign-In                |
| GET    | /api/auth/me     | Get current user from token   |
| GET    | /api/notes       | List your notes               |
| POST   | /api/notes       | Create a note                 |
| GET    | /api/notes/:id   | Get one note                  |
| PUT    | /api/notes/:id   | Update a note                 |
| DELETE | /api/notes/:id   | Delete a note                 |

All `/api/notes/*` routes require `Authorization: Bearer <token>`.

## Notes on going to production

This is built for local development. Before deploying publicly:
- Swap `JWT_SECRET` for a real secret stored securely (not committed).
- Add rate limiting to `/api/auth/*` (e.g. `express-rate-limit`).
- Serve the frontend over HTTPS — Google Sign-In requires it outside localhost.
- Add your production domain to the Google Cloud Console's Authorized JavaScript origins.
- Consider moving from SQLite to Postgres if you expect concurrent writes at scale.
