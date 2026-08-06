# MongoDB Persistence — Construction Intelligence Hub

MongoDB is now the **only** database in the project (no Postgres/SQLite). Everything is stored in `app.py` via `pymongo`.

## 1. Install + configure

```bash
pip install pymongo
```

Add to `.env`:

```
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=construction_intelligence_hub
```

(For Atlas: `MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority`)

Add `pymongo` to `requirements.txt`.

## 2. Collections

| Collection | Contents |
|---|---|
| `projects` | One doc per project: wizard input + the **full live state** (risks, materials, safety, timeline, alerts, chat) |
| `chat_messages` | Append-only audit trail of every copilot message (role, text, module, attachment) |
| `documents` | Metadata for every uploaded construction document (name, size, type, extracted chars) |
| `daily_reports` | AI-authored Daily Progress Reports, keyed by `reportDate` |
| `activity_log` | Which API action ran, when, against which project |

Indexes are created automatically on first connection.

## 3. How persistence works

- `POST /api/init-project` → creates the project doc (`PRJ-<timestamp>`) and sets it active.
- An HTTP middleware writes the full state through to Mongo after **every successful `POST /api/*`**, so material estimates, risk analyses, safety hazards, weather updates and simulations are all saved with no per-endpoint code.
- On startup the most recently updated project is **restored automatically**, so a `uvicorn` restart no longer wipes the site.
- If Mongo is unreachable the app logs a warning and keeps running fully in-memory — no feature breaks.

## 4. New read endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/db/status` | Connection state, active project id |
| `GET /api/db/projects` | List saved projects |
| `POST /api/db/load-project/{id}` | Re-activate a saved project (returns full state) |
| `GET /api/db/chat-history` | Full chat history from DB |
| `GET /api/db/documents` | Uploaded document history |
| `GET /api/db/daily-reports` | Saved DPRs |
| `GET /api/db/activity-log` | Audit trail |

## 5. Note

`db_save_daily_report(report)` is ready to call from your `/api/generate-daily-report` endpoint (that endpoint lives in your local `app.py`) — add one line at the end of it:

```python
db_save_daily_report(report)
```
