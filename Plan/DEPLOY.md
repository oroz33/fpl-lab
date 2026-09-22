# Production deploy (free) — GitHub + Vercel

This app uses a local `data/store.json` in development. On Vercel, the store
**must** live in **Vercel Blob** (`BLOB_READ_WRITE_TOKEN`). Without Blob,
ingest may appear to succeed on one serverless instance while `/api/meta`
still shows only the Man City seed — filesystem writes do not persist.

## 1. Push to GitHub

```bash
# Create repo (if needed) then:
git remote add origin https://github.com/<YOU>/fpl-lab.git
git push -u origin master
```

Do not commit `data/store.json` (gitignored). Upload data after deploy.

## 2. Import on Vercel

1. Open https://vercel.com → **Add New Project** → import the GitHub repo
2. Framework: **Next.js** (auto-detected) → Deploy once

## 3. Blob store + env

1. Vercel project → **Storage** → Create **Blob** store (public) → connect to this project  
   (injects `BLOB_READ_WRITE_TOKEN`)
2. **Settings → Environment Variables** → add:
   - `ADMIN_SECRET` = a strong password you choose
3. **Redeploy** so env vars apply

## 4. After go-live

1. Open the site → **Upload Opta Feed**
2. Enter the same value as `ADMIN_SECRET`
3. **Load Man City GW1–3** or batch-upload your JSON
4. Refresh — data should persist in Blob. Confirm via `/api/meta`:
   `storageMode` must be `"blob"`, and `teams` / `snapshotCount` should grow after ingest.

## Local vs production

| | Local | Production |
|--|--------|------------|
| Store | `data/store.json` | Vercel Blob `fpl-lab/store.json` |
| Writes | open (no secret) | require `ADMIN_SECRET` |
