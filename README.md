# SocialHub

Multi-platform social publishing & team collaboration tool.

**Stack (revised):** React + Vite (client) · Node + TypeScript + Express (server) ·
**PostgreSQL + Drizzle ORM** · RabbitMQ (scheduling, later phase) · Cloudinary (media, later phase).

> Note: the original blueprint specified MongoDB/Mongoose. We switched to
> PostgreSQL + Drizzle because the data model is relational (workspaces, members,
> posts, targets, analytics). Prisma was intentionally not used.

---

## Phase 1 — Foundation (in progress)

### ✅ Done so far: Authentication (backend + frontend)

**Backend:**
- Register / Login / Refresh / Logout / `GET /me`
- JWT **access tokens** (short-lived) + **refresh tokens** with server-side
  tracking, atomic rotation, and reuse-detection
- Passwords hashed with bcrypt
- Refresh token stored in an **httpOnly cookie** (XSS-resistant), scoped to `/api/auth`
- Zod request validation, rate limiting on auth endpoints, Helmet, CORS, central error handling

**Frontend** (`client/` — React + Vite + Tailwind v4):
- Modern dark UI (zinc-950, violet/indigo, grid + glow, split-screen auth, glass cards)
- Login, Register, and a Dashboard with **Sign out**
- `useAppData()` context: in-memory access token + silent refresh on load (session survives reload)
- Route guards (protected + public-only) and a Vite `/api` dev proxy so the cookie "just works"

**Workspaces & team (backend):**
- Create/list/rename/delete workspaces; creator becomes **OWNER**
- Roles: `OWNER · EDITOR · REVIEWER · VIEWER`, enforced by `requireWorkspaceMember` + `requireWorkspaceRole`
- **Invitation flow** by email (token + 7-day expiry): invite → preview → accept (email must match); duplicate/already-member guarded
- Member management: change role, remove member (or self-leave); the sole owner can't be demoted or removed

**Workspace UI** (`client/`):
- App shell with a **workspace switcher** (create / switch), sticky glass navbar, Overview + Members nav
- **Onboarding** screen to create your first workspace; **Dashboard** overview (role, members, created)
- **Members** page: invite by email (owner) with a copyable invite link, pending-invite list + revoke, inline role changes, remove / self-leave
- **Accept-invite** page (`/invite/:token`): public preview + sign-in-to-accept flow (with `?next=` redirect)
- API client hardened: in-memory token + transparent 401→refresh→retry interceptor

---

## Prerequisites
- Node.js 20+ (tested on 24)
- Docker Desktop (for local Postgres)

## Getting started

```bash
# 1. Start Postgres (from the repo root)
docker compose up -d

# 2. Install server deps
cd server
npm install

# 3. Create your env file (defaults already match docker-compose)
cp .env.example .env    # on Windows PowerShell: Copy-Item .env.example .env

# 4. Create the database tables
npm run db:generate     # generates SQL migration from the Drizzle schema
npm run db:migrate      # applies it to Postgres
#   (or, for quick local dev without migration files:)
# npm run db:push

# 5. Run the API (dev, auto-reload)
npm run dev
# -> http://localhost:4000/api/health
```

### Frontend (in a second terminal)
```bash
cd client
npm install
npm run dev
# -> http://localhost:5173   (Vite proxies /api to the backend on :4000)
```
Open http://localhost:5173, register an account, and you'll land on the dashboard.
Reloading keeps you signed in (silent refresh); "Sign out" clears the session.

## Auth API

| Method | Route                | Auth        | Body                          |
|--------|----------------------|-------------|-------------------------------|
| POST   | `/api/auth/register` | –           | `{ email, password, name }`   |
| POST   | `/api/auth/login`    | –           | `{ email, password }`         |
| POST   | `/api/auth/refresh`  | cookie      | –                             |
| POST   | `/api/auth/logout`   | cookie      | –                             |
| GET    | `/api/auth/me`       | Bearer      | –                             |

`register`/`login` return `{ user, accessToken }` and set the `refreshToken`
httpOnly cookie. Send the access token as `Authorization: Bearer <token>` for
protected routes. Call `/refresh` (which reads the cookie) to get a new access
token when it expires.

### Quick manual test (after the server is running)
```bash
curl -i -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"password123","name":"You"}'
```

## Workspace API
All routes require `Authorization: Bearer <accessToken>` unless noted.

| Method | Route | Role | Purpose |
|--------|-------|------|---------|
| POST | `/api/workspaces` | any | Create workspace (you become OWNER) |
| GET | `/api/workspaces` | any | List workspaces you belong to |
| GET | `/api/workspaces/:id` | member | Workspace + members |
| PATCH | `/api/workspaces/:id` | OWNER | Rename |
| DELETE | `/api/workspaces/:id` | OWNER | Delete |
| POST | `/api/workspaces/:id/invite` | OWNER | Invite by email `{email, role}` |
| GET | `/api/workspaces/:id/invitations` | OWNER | List pending invites |
| DELETE | `/api/workspaces/:id/invitations/:invitationId` | OWNER | Revoke invite |
| PATCH | `/api/workspaces/:id/members/:userId` | OWNER | Change role `{role}` |
| DELETE | `/api/workspaces/:id/members/:userId` | member | Remove member / leave |
| GET | `/api/invitations/:token` | public | Preview an invitation |
| POST | `/api/invitations/:token/accept` | auth | Accept (email must match) |

## Connections API (Phase 2 — YouTube)
OAuth tokens are stored **AES-256-GCM encrypted** at rest; token columns are never returned.

| Method | Route | Role | Purpose |
|--------|-------|------|---------|
| GET | `/api/connections?workspaceId=` | member | List connected accounts (no tokens) |
| GET | `/api/connections/oauth/:platform/start?workspaceId=` | OWNER/EDITOR | Returns the provider consent URL |
| GET | `/api/connections/oauth/:platform/callback` | public* | OAuth redirect target (*trust via signed `state`) |
| DELETE | `/api/connections/:id` | OWNER/EDITOR | Disconnect |

### Enabling YouTube (Google Cloud)
1. Create a project at [console.cloud.google.com](https://console.cloud.google.com); enable **YouTube Data API v3**.
2. Configure the **OAuth consent screen** (External; add yourself as a test user).
3. Create an **OAuth 2.0 Client ID** (type: Web application) with authorized redirect URI:
   `http://localhost:4000/api/connections/oauth/youtube/callback`
4. Put the credentials in `server/.env`:
   ```
   YOUTUBE_CLIENT_ID=...
   YOUTUBE_CLIENT_SECRET=...
   ENCRYPTION_KEY=<openssl rand -hex 32>
   ```
5. Restart the API. In the app, open **Connections → Connect** on YouTube.

> Until credentials are set, "Connect" returns a friendly "not configured" message — the rest of the app works normally.

### Enabling Instagram (Meta — "API setup with Instagram business login")
1. Switch your Instagram account to **Professional** (Business or Creator). No Facebook Page needed for this flow.
2. Create a Meta app at [developers.facebook.com](https://developers.facebook.com) and add the **Instagram** product → **"API setup with Instagram business login."**
3. Copy the **Instagram App ID** + **Instagram App Secret**, and add the redirect URI:
   `http://localhost:4000/api/connections/oauth/instagram/callback`
4. Add your IG account as an **Instagram tester** (App roles) and accept the invite in the Instagram app — this lets you publish to your own account without full App Review.
5. Put the credentials in `server/.env`:
   ```
   INSTAGRAM_APP_ID=...
   INSTAGRAM_APP_SECRET=...
   ```
6. Restart the API. **Connections → Connect** on Instagram. Instagram publishes **image** posts (the media must be an image; feed images are delivered as JPEG). Publishing to accounts other than your own testers requires Meta App Review.

## Posts API (Phase 3 — backend)
A post has per-platform **targets** (a connection + caption) and moves through a review workflow.

**Statuses:** `DRAFT → PENDING_REVIEW → APPROVED → (SCHEDULED) → PUBLISHED / FAILED`

| Method | Route | Role | Purpose |
|--------|-------|------|---------|
| POST | `/api/posts` | OWNER/EDITOR | Create draft `{workspaceId, title?, mediaUrl?, targets:[{connectionId, caption?}]}` |
| GET | `/api/posts?workspaceId=&status=` | member | List posts (optional status filter) |
| GET | `/api/posts/:id` | member | Post + targets |
| PATCH | `/api/posts/:id` | OWNER/EDITOR | Edit (drafts only); `targets` replaces the set |
| DELETE | `/api/posts/:id` | OWNER/EDITOR | Delete (not when PUBLISHED) |
| POST | `/api/posts/:id/submit` | OWNER/EDITOR | DRAFT → PENDING_REVIEW (needs ≥1 target) |
| POST | `/api/posts/:id/approve` | OWNER/REVIEWER | PENDING_REVIEW → APPROVED |
| POST | `/api/posts/:id/request-changes` | OWNER/REVIEWER | PENDING_REVIEW → DRAFT |
| POST | `/api/posts/:id/publish` | OWNER/EDITOR | APPROVED → PUBLISHED, uploads to YouTube `{visibility?}` |
| POST | `/api/posts/:id/schedule` | OWNER/EDITOR | APPROVED → SCHEDULED `{scheduledFor, visibility?}` (auto-publishes later) |
| POST | `/api/posts/:id/unschedule` | OWNER/EDITOR | SCHEDULED → APPROVED (cancel) |

Every target's `connectionId` must belong to the post's workspace.

### Publishing to YouTube
`POST /api/posts/:id/publish` with `{ "visibility": "private" | "unlisted" | "public" }`
(defaults to **private**). The post is atomically claimed (`APPROVED|FAILED → PUBLISHING`)
so a double-click can't publish twice, then each target uploads independently:

- The stored OAuth access token is refreshed (and re-encrypted) if it's stale.
- The post's media is streamed from Cloudinary into a YouTube **resumable upload**
  (`snippet` = title/caption, `status.privacyStatus` = visibility).
- Each target records `publishStatus` / `publishedUrl` / `errorMessage`; the post ends
  **PUBLISHED** (all targets ok) or **FAILED** (any error). Re-publishing a FAILED post
  retries only the targets that didn't already succeed.

> Publishing runs inline (fine for short clips).
> The media must be a **video** — YouTube rejects images.

### Scheduling
`POST /api/posts/:id/schedule` with `{ "scheduledFor": "<ISO 8601>", "visibility": "private" }`
moves an approved post to **SCHEDULED** and stores the time + visibility. An in-process
worker (`modules/posts/scheduler.ts`, polling every `SCHEDULER_INTERVAL_SECONDS`, default 30)
atomically claims due posts and publishes them — the atomic `UPDATE ... RETURNING` claim
means overlapping ticks or multiple server instances can't double-publish. The same tick also
reaps any post stuck in PUBLISHING past a stale window (e.g. a crash mid-upload) back to
FAILED so it's retryable. `unschedule` returns a post to APPROVED. Set
`SCHEDULER_INTERVAL_SECONDS=0` to disable the worker.

> YouTube's public API has **no Community-post / image-post endpoint** (it only uploads
> videos), so image posting will arrive when we add an image-capable platform.

## Analytics API

| Method | Route | Role | Purpose |
|--------|-------|------|---------|
| GET | `/api/analytics?workspaceId=` | member | Live view/like/comment counts for published posts |

Returns `{ totals, posts[] }`. For every **published** target the server pulls current
stats from YouTube (`videos.list?part=statistics`, batched at 50 ids/call, one call per
connected channel) using the stored (auto-refreshed) OAuth token. A per-connection failure
(e.g. a revoked token) is reported on that connection's rows without failing the response.
The **Analytics** page (`client/`, `/analytics`) shows workspace totals + a per-post breakdown
with links to each video.

**Compose UI** (`client/`, `/posts`): posts list with status filters, a composer
(title, **media upload**, per-account target picker with captions), and the review
workflow (submit / approve / request-changes) with role-aware actions.

## Media API (Cloudinary)
The browser uploads files **directly to Cloudinary** using a short-lived
server-generated signature — large videos never pass through the API. The
`api_secret` stays on the server; only the signature + public `cloud_name`/`api_key`
reach the client.

| Method | Route | Role | Purpose |
|--------|-------|------|---------|
| POST | `/api/media/sign?workspaceId=` | OWNER/EDITOR | Returns `{cloudName, apiKey, timestamp, folder, signature}` for one upload |

### Enabling uploads (Cloudinary)
1. Grab your **cloud name**, **API key**, and **API secret** from the Cloudinary dashboard.
2. Put them in `server/.env`:
   ```
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   ```
3. Restart the API. In the composer, drag-and-drop (or click) to upload an image/video.

> Until credentials are set, the sign endpoint returns a friendly "not configured" message.
> Uploads are scoped to a per-workspace folder (`socialhub/<workspaceId>`); the 100 MB
> client-side limit matches Cloudinary's free-tier video cap.

## Project layout
```
social-hub/
├── docker-compose.yml       # local Postgres
├── server/
│   ├── drizzle.config.ts
│   └── src/
│       ├── config/env.ts    # validated environment
│       ├── db/              # Drizzle schema + connection
│       ├── lib/             # errors, asyncHandler
│       ├── middleware/      # requireAuth, validate, errorHandler
│       ├── modules/auth/    # tokens, service, controller, routes, schemas
│       ├── app.ts
│       └── index.ts
└── client/                  # React + Vite + Tailwind v4
    ├── vite.config.ts       # /api dev proxy -> :4000
    └── src/
        ├── context/AppContext.tsx   # useAppData() — auth state
        ├── lib/api.ts               # typed API client
        ├── components/ (ui, shared, layout)
        └── pages/ (auth/Login, auth/Register, dashboard/Dashboard)
```
