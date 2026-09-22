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

## 4. After go-live — sync local data to production

Do **not** re-upload Opta JSON on the production Upload UI for weekly updates.
Ingest locally, then overwrite Blob with your local store:

1. Put `BLOB_READ_WRITE_TOKEN` in `.env.local` (Vercel → Storage / Env), or:
   `npx vercel link --project fpl-lab && npx vercel env pull .env.local --environment=production`
   (Blob env vars must not be marked Sensitive, or the pulled token will be empty.)
2. Ensure `data/store.json` looks correct on http://localhost:3000/
3. Run:

```bash
npm run sync:prod
```

This replaces Vercel Blob `fpl-lab/store.json` with your local store (full overwrite).
Player Data, H2H, Fixture Tracker, and all tabs then read the same data.

Confirm via https://fpl-lab-alpha.vercel.app/api/meta — `storageMode` must be `"blob"`,
and `snapshotCount` / teams should match local.

### Weekly workflow

1. Upload Opta feeds on localhost (Upload Opta Feed)
2. Verify Player Data / Fixture Tracker locally
3. `npm run sync:prod`
4. Hard-refresh production

## Local vs production

| | Local | Production |
|--|--------|------------|
| Store | `data/store.json` | Vercel Blob `fpl-lab/store.json` |
| Writes | open (no secret) | require `ADMIN_SECRET` for Upload UI; sync uses Blob token |
| Weekly sync | ingest here | `npm run sync:prod` |
