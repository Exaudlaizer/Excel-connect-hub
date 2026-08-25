# Deploying Excel Connect Hub

| Piece | Lives in | Deploys to | Why |
| --- | --- | --- | --- |
| Next.js frontend | `frontend/` | **Vercel** | What Vercel is built for. |
| Express API | `backend/` | **Render** | Serves uploaded images off local disk and keeps a long-lived Postgres pool. |
| Postgres | — | **Render** | Created by the same blueprint as the API. |

## Why the API is not on Vercel

Vercel runs serverless functions: no long-lived process, and a filesystem that
is ephemeral and read-only apart from `/tmp`. Two things in this API depend on
neither being true:

- `uploadController` writes to `backend/uploads/` and `app.js` serves it with
  `express.static`. On Vercel every uploaded image — including the admin
  background images — would 404 minutes after upload.
- `server.js` opens Postgres, Redis and SMTP connections at boot, once, and
  reuses them. Serverless re-does that per cold start.

Render runs an ordinary always-on Node process, so `server.js` deploys with no
changes at all. `backend/render.yaml` describes the whole thing.

> **Uploads on the free plan.** Render's free tier has no persistent disk. Files
> survive while the instance is alive but a redeploy or a spin-down wipes them.
> For permanent uploads, set `plan: starter` in `render.yaml` and uncomment the
> `disk:` block. Fine to leave as-is while testing.

---

## 1. Push the branch

Nothing here stops your local servers — Render and Vercel build on their own
machines.

```powershell
git add DEPLOYMENT.md backend/render.yaml backend/src/config/db.js backend/src/app.js backend/.env.example frontend/.env.example
git commit -m "Add Render + Vercel deployment configuration"
git push -u origin feature/platform-overhaul
```

---

## 2. Deploy the API and database (Render)

1. <https://dashboard.render.com> → **New** → **Blueprint**.
2. Connect `Exaudlaizer/Excel-connect-hub`, pick branch `feature/platform-overhaul`.
3. Render reads `backend/render.yaml` and offers one web service plus one
   Postgres database. It will ask for the values marked `sync: false`:
   - `CLIENT_ORIGIN` — put `http://localhost:3000` for now, corrected in step 4.
   - `PUBLIC_API_ORIGIN` — leave blank for now, corrected in step 4.
   - the `SMTP_*` keys — leave blank. Verification codes then print to the
     Render logs and the whole signup flow still works.
4. **Apply**. First build takes a few minutes.
5. When it is live, note the URL (`https://excel-connect-hub-api.onrender.com`)
   and open `/health`. You want `{"status":"ok",…}`.

### Create the tables

Render's shell tab, on the API service:

```
npm run db:migrate
npm run seed:admin -- --email=you@example.com --password=YourStrongPassword --name="Site Admin"
```

`db:migrate` only adds what is missing, so it is safe to re-run after any schema
change.

---

## 3. Deploy the frontend (Vercel)

1. <https://vercel.com/new> → import the same repository.
2. **Root Directory:** `frontend` ← the single most common mistake. Vercel
   defaults to the repo root, finds no Next.js app, and the build fails.
3. Framework Preset: **Next.js** (auto-detected).
4. Production branch: `feature/platform-overhaul` (Settings → Git), or merge to
   `main` first and leave this alone.
5. Environment variable:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_URL` | `https://excel-connect-hub-api.onrender.com/api` |

   The `/api` suffix matters — every route is mounted under it.

6. **Deploy.**

> There is deliberately **no `vercel.json`**. A plain Next.js app in a
> subdirectory needs none; Root Directory does the whole job. An unnecessary one
> is the usual source of "Invalid vercel.json".

> `NEXT_PUBLIC_*` is compiled into the JavaScript bundle at **build** time, not
> read at runtime. Change it later and you must redeploy the frontend.

---

## 4. Point the API back at the frontend

Render → your API service → **Environment**:

| Key | Value |
| --- | --- |
| `CLIENT_ORIGIN` | `https://your-app.vercel.app` |
| `PUBLIC_API_ORIGIN` | `https://excel-connect-hub-api.onrender.com` |

Save — Render restarts automatically. Until `CLIENT_ORIGIN` matches exactly
(scheme included, no trailing slash), the browser blocks every API call and the
UI reports a connection error.

---

## 5. Test on other devices

Open the Vercel URL on a phone, a tablet, anyone's laptop. Public HTTPS, no
tunnel, no shared Wi-Fi needed.

**First request after ~15 minutes idle takes up to a minute.** Render's free
tier spins the instance down; it is not broken, just waking. Load the API's
`/health` in another tab first if you are demoing to someone.

---

## Troubleshooting

**"Invalid vercel.json"**
There should be no `vercel.json` in this repo. If you added one, delete it and
set **Root Directory** to `frontend` instead. If you truly need one, note that
Vercel rejects unknown top-level keys — including `$schema` in some versions.

**Vercel build: "No Next.js version detected"**
Root Directory is not set to `frontend`.

**"Unable to connect to the authentication service"**
DevTools → Network:
- `ERR_NAME_NOT_RESOLVED` → `NEXT_PUBLIC_API_URL` wrong; fix and **redeploy**.
- CORS error → `CLIENT_ORIGIN` on Render does not match the Vercel URL exactly.
- Long hang then success → free-tier cold start, see above.

**"no pg_hba.conf entry" / "SSL required"**
`DATABASE_URL` is not the Render internal connection string, or TLS was disabled.
`db.js` turns TLS on automatically for any non-localhost host.

**`relation "users" does not exist"`**
Step 2's migration never ran.

**Uploaded images 404 after a redeploy**
Expected on the free plan. See the note at the top.

---

## Running locally (unchanged)

```powershell
cd backend;  npm run dev     # terminal 1
cd frontend; npm run dev     # terminal 2
```

Your local `.env` and `.env.local` are never read by Render or Vercel, and
nothing in this guide modifies them.
