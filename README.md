# Docket

**An attachment-first Gmail client for people who live in their files, not their inbox.**

Traditional email clients are **messaging-first**. Threads, unread counts, reply-all, and the inbox timeline are the product. Attachments are a secondary detail — something you open from inside a message, if you remember which message held the invoice, the lease, or the tax form.

**Docket flips that constraint.**

The unit of work is the **document** (PDF, image, spreadsheet, receipt, statement). The email is metadata that explains where the file came from. Search, filter, tag, preview, and download are organized around attachments — not conversations.

If your real question is *“Where is that file someone emailed me?”* instead of *“What did they say?”*, Docket is built for that.

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

That is the requirement it satisfies: **attachment-first email, without abandoning the mail that delivered the file.**

---

## What you get

- **Document table** — filename, download-as name, sender, tags, date, size; sortable / resizable columns  
- **Tags** — shared tag list, typeahead, create-as-you-type, Any (OR) / All (AND) filtering  
- **Editable download names** — rename what leaves the archive without renaming the original attachment  
- **Side preview** — metadata + full stored email body under it; open the attachment in a viewer  
- **Attachment previews** — PDF, images, text, Office (docx/xlsx), ICS, EML, audio/video where the browser allows  
- **On-demand disk cache** — first preview hits IMAP; repeats serve from local cache (much faster)  
- **Bulk download** — zip selected documents  
- **Incremental sync** — SQLite persistence; sync button with live progress (no full re-pull every load)  
- **LAN-friendly** — server binds `0.0.0.0` (default port `8420`)

Read-only by design: Docket does not send mail or mutate your Gmail mailbox.

---

## Architecture

```
Gmail (IMAP) ──scan──► SQLite (documents, tags, attachment refs)
                         │
                         ├── API (Express)
                         │     GET  /api/documents
                         │     GET  /api/tags
                         │     PATCH /api/documents/:id   (tags, download filename)
                         │     GET  /api/documents/:id/preview
                         │     GET  /api/documents/:id/download
                         │     POST /api/sync  (SSE progress)
                         │
                         └── React SPA (packages/frontend)
                               table · filters · preview · viewer

Attachment bytes: IMAP on first request → data/attachments/ cache → later hits are local
```

| Layer | Role |
| --- | --- |
| `server.js` | HTTP API + static UI |
| `lib/imapClient.js` | IMAP scan / download |
| `lib/db.js` | SQLite schema and queries |
| `lib/attachmentCache.js` | On-disk attachment cache |
| `packages/frontend` | Vite + React + TypeScript UI |

---

## Quick start

### Requirements

- Node.js 18+ (with build tools for `better-sqlite3`)  
- A Gmail account with **2FA** and an [App Password](https://myaccount.google.com/apppasswords)

### Setup

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
| `IMAP_LABELS` | Comma-separated mailboxes/labels (default `INBOX`) |
| `IMAP_SINCE_DAYS` | How far back to scan (default `730`) |
| `IMAP_MAX_MESSAGES` | Cap per label (default `2000`) |
| `PORT` | HTTP port (default `8420`) |

**Never commit `.env`.** Credentials stay local.

---

## What Docket is not

- Not a replacement for Gmail for day-to-day conversation  
- Not a full mail client (no compose / send / reply)  
- Not a cloud SaaS — you run it yourself  
- Not open source for reuse — see license below  

---

## License

**All Rights Reserved.** See [`LICENSE`](LICENSE).

This repository is published so the source may be **viewed**. Copying, modifying, redistributing, or building on this code requires prior written permission. Viewing the repo does not grant a license to use the software beyond personal inspection of the source as hosted.

---

## Repo

**https://github.com/chillidawgzz/Docket**
