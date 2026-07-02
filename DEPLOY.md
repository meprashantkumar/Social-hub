# Deploying SocialHub to AWS EC2

Target: a single Ubuntu EC2 instance serving **https://socialhub.smalltowncoder.in**.

**Architecture**
- **Nginx** serves the built React client (`client/dist`) and reverse-proxies `/api` → the Node API on `127.0.0.1:4000`, and terminates TLS.
- **Node API** runs under **PM2** (auto-restart + starts on boot). The publish scheduler runs in-process.
- **Postgres** runs via the repo's `docker-compose.yml` on the same instance.
- **Certbot** issues/renews the Let's Encrypt cert.

Everything is under one origin, so the client's relative `/api` calls and the OAuth cookies work without CORS gymnastics.

---

## 0. Push the code to GitHub (once, from your machine)

The project isn't a git repo yet, and `.env` is gitignored (secrets never get committed — verify with `git status`).

```bash
cd "d:/social hub"
git init
git add .
git commit -m "SocialHub"
# create an EMPTY repo on GitHub first (private recommended), then:
git remote add origin https://github.com/<you>/social-hub.git
git branch -M main
git push -u origin main
```

Confirm `server/.env` is **not** in the pushed files.

---

## 1. Launch the EC2 instance

- **AMI:** Ubuntu Server 24.04 LTS
- **Type:** `t3.small` recommended. `t2.micro` (free tier) works but is tight for builds — if you use it, add swap (step 3).
- **Key pair:** create/download one for SSH.
- **Security group — inbound rules:**
  | Port | Source | Why |
  |---|---|---|
  | 22 | *Your IP* | SSH |
  | 80 | 0.0.0.0/0 | HTTP (Certbot + redirect) |
  | 443 | 0.0.0.0/0 | HTTPS |

  **Do NOT open 5432** — Postgres stays private to the instance.
- **Elastic IP:** allocate one and associate it with the instance, so the public IP is stable for DNS.

---

## 2. Point the subdomain at the instance (Hostinger)

In Hostinger → your domain → DNS/Nameservers → add an **A record**:
- **Type:** A
- **Name/Host:** `socialhub`
- **Points to:** your **Elastic IP**
- **TTL:** default

Verify (may take a few minutes): `dig +short socialhub.smalltowncoder.in` should return your Elastic IP.

---

## 3. SSH in and install dependencies

```bash
ssh -i your-key.pem ubuntu@<ELASTIC_IP>

sudo apt-get update && sudo apt-get -y upgrade

# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx

# Docker + compose plugin (official convenience script)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # then log out & back in so `docker` works without sudo

# Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# PM2
sudo npm install -g pm2
```

**Optional (only on t2.micro) — add 2 GB swap so builds don't OOM:**
```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 4. Clone the repo

```bash
cd ~
git clone https://github.com/<you>/social-hub.git
cd social-hub
```

(Path used throughout: `/home/ubuntu/social-hub`.)

---

## 5. Start Postgres (Docker)

Pick a strong DB password and put it in a **root** `.env` (gitignored) — Docker Compose reads it for `${POSTGRES_PASSWORD}`:

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" > /home/ubuntu/social-hub/.env
cat .env   # copy this password; you'll reuse it in DATABASE_URL below

docker compose up -d
docker compose ps   # postgres should be "healthy"
```

The compose file maps `5432` on the host, but the security group blocks it externally, so it's only reachable from the instance (the API connects via `localhost`).

---

## 6. Create `server/.env` (production values)

```bash
nano /home/ubuntu/social-hub/server/.env
```

Fill in — generate fresh secrets, don't reuse the dev placeholders:

```dotenv
NODE_ENV=production
PORT=4000

CLIENT_ORIGIN=https://socialhub.smalltowncoder.in
API_BASE_URL=https://socialhub.smalltowncoder.in

# Use the SAME password you generated in step 5:
DATABASE_URL=postgres://app:<POSTGRES_PASSWORD>@localhost:5432/socialhub

# Generate each with: openssl rand -hex 32
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=30

# HTTPS in prod:
COOKIE_SECURE=true
COOKIE_SAMESITE=lax

ENCRYPTION_KEY=<openssl rand -hex 32>
OAUTH_STATE_SECRET=<openssl rand -hex 32>

# OAuth app creds (reuse yours):
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_API_VERSION=202506
X_CLIENT_ID=...
X_CLIENT_SECRET=...

# Cloudinary (reuse):
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

SCHEDULER_INTERVAL_SECONDS=30
```

> Note: `ENCRYPTION_KEY` protects stored OAuth tokens. This is a fresh DB, so a new key is fine — just don't change it later or existing connections stop decrypting.

---

## 7. Build, migrate, and run the API

```bash
cd /home/ubuntu/social-hub/server
npm install
npm run build          # tsc -> dist/
npm run db:migrate     # applies drizzle/*.sql to the prod DB

pm2 start ecosystem.config.cjs
pm2 save
pm2 startup            # run the command it prints (sets PM2 to start on boot)

pm2 logs socialhub-api --lines 30   # should show "SocialHub API running"
curl http://localhost:4000/api/health   # {"status":"ok",...}
```

---

## 8. Build the client and publish it to the web root

```bash
cd /home/ubuntu/social-hub/client
npm install
npm run build          # -> client/dist

sudo mkdir -p /var/www/socialhub
sudo cp -r dist/* /var/www/socialhub/
```

---

## 9. Configure Nginx

```bash
sudo cp /home/ubuntu/social-hub/deploy/nginx/socialhub.conf /etc/nginx/sites-available/socialhub
sudo ln -s /etc/nginx/sites-available/socialhub /etc/nginx/sites-enabled/socialhub
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t          # config OK?
sudo systemctl reload nginx
```

Visit `http://socialhub.smalltowncoder.in` — the app should load over HTTP.

---

## 10. Enable HTTPS

```bash
sudo certbot --nginx -d socialhub.smalltowncoder.in
```

Choose the redirect option so HTTP → HTTPS. Certbot auto-renews via a systemd timer. Now `https://socialhub.smalltowncoder.in` is live.

---

## 11. Update OAuth redirect URIs (CRITICAL)

Connecting accounts will fail until each provider knows the production callback. Add these **in addition to** the localhost ones:

- **YouTube** (Google Cloud Console → APIs & Services → Credentials → your OAuth client → *Authorized redirect URIs*):
  `https://socialhub.smalltowncoder.in/api/connections/oauth/youtube/callback`
  (Also add `socialhub.smalltowncoder.in` under the OAuth consent screen's authorized domains; keep your account as a Test user if the app is in "Testing".)
- **LinkedIn** (developer app → Auth → *Authorized redirect URLs*):
  `https://socialhub.smalltowncoder.in/api/connections/oauth/linkedin/callback`
- **X** (developer app → User authentication settings → *Callback URI*):
  `https://socialhub.smalltowncoder.in/api/connections/oauth/x/callback`
- **Instagram** — currently "Soon" in the UI; skip until re-enabled.

---

## 12. Verify

Open `https://socialhub.smalltowncoder.in`, then: register → create a workspace → Connections → connect YouTube/LinkedIn → compose a post → publish. (X connects but can't post until its account has credits.)

---

## Redeploying after a code change

```bash
cd /home/ubuntu/social-hub
git pull

cd server && npm install && npm run build && npm run db:migrate && pm2 restart socialhub-api
cd ../client && npm install && npm run build && sudo cp -r dist/* /var/www/socialhub/
```

(Reload Nginx only if you changed `deploy/nginx/socialhub.conf`.)

---

## Troubleshooting

- **502 Bad Gateway** → API isn't running: `pm2 logs socialhub-api`. Often a bad `DATABASE_URL` or a missing env var (the app exits on invalid env).
- **DB connection refused** → `docker compose ps`; ensure the `DATABASE_URL` password matches step 5.
- **OAuth "redirect_uri mismatch"** → the provider's registered URI must match `https://socialhub.smalltowncoder.in/api/connections/oauth/<platform>/callback` exactly (step 11).
- **Client loads but API 404s** → check the `/api/` Nginx location and that PM2 shows the API online.
- **Build killed / OOM on t2.micro** → add swap (step 3).
- **Postgres data** lives in the `pgdata` Docker volume — back it up (`docker exec socialhub-postgres pg_dump -U app socialhub > backup.sql`) before major changes.
