# Docket

**An attachment-first Gmail client for people who live in their files, not their inbox.**

**MVP** — self-hosted attachment-first Gmail archive with a real **backend** (`backend/`) and **UI** (`packages/frontend`). Shipping enough to prove the paradigm: find and work with documents from email without living in an inbox.

> **Copyright © 2026 chillidawgzz — All Rights Reserved.**  
> Source may be viewed. Copying, modifying, or redistributing requires permission. See [`LICENSE`](LICENSE).

Traditional email clients are **messaging-first**. Threads, unread counts, reply-all, and the inbox timeline are the product. Attachments are a secondary detail — something you open from inside a message, if you remember which message held the invoice, the lease, or the tax form.

**Docket flips that constraint.**

The unit of work is the **document** (PDF, image, spreadsheet, receipt, statement). The email is metadata that explains where the file came from. Search, filter, tag, preview, and download are organized around attachments — not conversations.

If your real question is *“Where is that file someone emailed me?”* instead of *“What did they say?”*, Docket is built for that.

---

## What’s in the MVP

- **IMAP → SQLite** — incremental sync indexes attachments into a local archive (`backend/`)
- **Document table** — filename, download-as name, sender, tags, date, size; sortable / resizable
- **Tags** — shared list, typeahead, create-as-you-type, Any (OR) / All (AND) filter
- **Editable download names** — rename what you download without changing the original attachment
- **Preview** — metadata + stored email body; open the file in an attachment viewer
- **Attachment previews** — PDF, images, text, Office (docx/xlsx), ICS, EML, audio/video where the browser allows
- **Disk cache** — first preview hits IMAP; repeats serve from `data/attachments/`
- **Bulk zip download** + LAN bind (`0.0.0.0:8420`)
- **Docker** — same stack via [`Dockerfile`](Dockerfile) / [`docker-compose.yml`](docker-compose.yml)

Express API lives under [`backend/`](backend/) (documents, tags, patch, preview, download, sync SSE). UI is [`packages/frontend/`](packages/frontend/).

---

## Not in the MVP

- Compose / send / reply (read-only on purpose)
- Replacing Gmail for day-to-day conversation
- Cloud SaaS hosting — you run it yourself
- Open-source reuse rights — proprietary; view only (see [`LICENSE`](LICENSE))

---

## MVP codebase layout

| Path | What it is |
| --- | --- |
| [`backend/`](backend/) | Express HTTP API, IMAP sync, SQLite, attachment cache |
| [`backend/server.js`](backend/server.js) | API entrypoint |
| [`backend/lib/`](backend/lib/) | IMAP client, DB, preview types, disk cache |
| [`packages/frontend/`](packages/frontend/) | React + TypeScript SPA (Vite) |
| [`Dockerfile`](Dockerfile) | Container image (API + built UI) |
| [`docker-compose.yml`](docker-compose.yml) | One-command Docker run with persistent data |
| [`LICENSE`](LICENSE) | Proprietary copyright — view only, not free to copy |
| [`.env.example`](.env.example) | Required Gmail/IMAP config template (no secrets) |

---

## Why this exists

| Messaging-first (Gmail, Outlook, Apple Mail) | Attachment-first (Docket) |
| --- | --- |
| Primary object: message / thread | Primary object: attachment / document |
| Attachments are nested inside mail | Mail is context under the file |
| Good for conversation | Good for archives, paperwork, receipts |
| Find by subject / sender / date of *email* | Find by filename, sender, tags, date of *document* |
| Preview means reading the body | Preview means viewing the file (and the email under it) |

Most “document” problems in email are not communication problems. They are **retrieval** problems:

- invoices and statements buried under marketing and replies  
- the same vendor emailing under slightly different subjects  
- needing the PDF, not the thread that carried it  
- wanting tags like `tax` / `lease` / `medical` on the *file*, not a Gmail label on a message  

Docket treats Gmail as a **read-only document feed** over IMAP, indexes attachments into a local SQLite archive, and gives you a table + preview UI that assumes the file is the thing you care about.

That is the requirement this MVP satisfies: **attachment-first email, without abandoning the mail that delivered the file.**

---

## Architecture

```
Gmail (IMAP) ──scan──► SQLite (documents, tags, attachment refs)
                         │
                         ├── backend/ (Express API)
                         │     GET  /api/documents
                         │     GET  /api/tags
                         │     PATCH /api/documents/:id   (tags, download filename)
                         │     GET  /api/documents/:id/preview
                         │     GET  /api/documents/:id/download
                         │     POST /api/sync  (SSE progress)
                         │
                         └── packages/frontend (React SPA)
                               table · filters · preview · viewer

Attachment bytes: IMAP on first request → data/attachments/ cache → later hits are local
```

| Layer | Role |
| --- | --- |
| `backend/server.js` | HTTP API + static UI |
| `backend/lib/imapClient.js` | IMAP scan / download |
| `backend/lib/db.js` | SQLite schema and queries |
| `backend/lib/attachmentCache.js` | On-disk attachment cache |
| `packages/frontend` | Vite + React + TypeScript UI |

---

## Quick start

### Requirements

- Node.js 18+ (with build tools for `better-sqlite3`), **or Docker**
- A Gmail account with **2FA** and an [App Password](https://myaccount.google.com/apppasswords)

### Docker (recommended for self-hosters)

Same MVP, packaged for people who already run everything in Docker:

```bash
git clone git@github.com:chillidawgzz/Docket.git
cd Docket
cp .env.example .env
# edit .env — set GMAIL_USER and GMAIL_APP_PASSWORD

# Bind mounts need a real file (not a directory) for the SQLite DB
touch data.db
mkdir -p data/attachments

docker compose up --build -d
```

Open `http://localhost:8420` (or `http://<your-lan-ip>:8420`).

Use **Sync** in the UI to pull attachments into the local archive. Data persists in `./data.db` and `./data/` on the host.

Stop:

```bash
docker compose down
```

Or without Compose:

```bash
docker build -t docket:mvp .
docker run --rm -p 8420:8420 --env-file .env \
  -v "$(pwd)/data.db:/app/data.db" \
  -v "$(pwd)/data:/app/data" \
  docket:mvp
```

### Bare metal (Node)

```bash
git clone git@github.com:chillidawgzz/Docket.git
cd Docket
cp .env.example .env
# edit .env — set GMAIL_USER and GMAIL_APP_PASSWORD
npm install
npm run build
npm start
```

Open `http://localhost:8420` (or `http://<your-lan-ip>:8420`).

Use **Sync** in the UI to pull attachments into the local archive.

### Development

```bash
npm run dev   # API + Vite frontend together
```

### Environment

See [`.env.example`](.env.example). Critical variables:

| Variable | Purpose |
| --- | --- |
| `GMAIL_USER` | Gmail address |
| `GMAIL_APP_PASSWORD` | 16-character app password |
| `IMAP_LABELS` | Mailboxes to scan: `*` (all / Gmail All Mail), or comma-separated labels (default `*`) |
| `IMAP_SINCE_DAYS` | How far back to scan (default `730`) |
| `IMAP_MAX_MESSAGES` | Cap per label (default `2000`) |
| `PORT` | HTTP port (default `8420`) |

**Never commit `.env`.** Credentials stay local. Pass them into Docker via `env_file: .env` / `--env-file .env`.

---

## License / copyright

**Copyright © 2026 chillidawgzz. All Rights Reserved.**

Full terms: [`LICENSE`](LICENSE).

This repository (backend and frontend) is published so the source may be **viewed**. You may **not** copy, reproduce, modify, merge, publish, distribute, sublicense, sell, or otherwise use this software or any substantial portion of it without prior written permission. Viewing the repo does not grant a license to use the code.

---

## Repo

**https://github.com/chillidawgzz/Docket**
