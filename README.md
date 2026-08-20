# Agentic AI For Safety Monitoring with Construction Risk Analytics

> AI-powered construction project management platform that unifies risk, safety, materials, timeline, reporting, and executive insights into a single intelligent dashboard.

---

## Overview

Agentic AI For Safety Monitoring with Construction Risk Analytics is a full-stack application designed to act as a central AI brain for construction projects. Users create projects through an onboarding wizard, upload construction documents, and access intelligent modules powered by multiple AI providers.

The platform combines real-time weather intelligence, risk analysis, safety monitoring (including PPE image checks), material tracking, timeline optimization, daily AI-generated reports, and an executive command center. A multilingual construction copilot with voice input supports Indian languages via Sarvam AI speech-to-text.

---

## Tech Stack

### Frontend
- **Framework:** TanStack Start (React 19, file-based routing, SSR/SSG ready)
- **Build Tool:** Vite 7
- **Styling:** Tailwind CSS v4
- **State Management:** TanStack Query (React Query)
- **UI Components:** shadcn/ui design tokens
- **Charts & Visuals:** Custom SVG Gantt charts, progress gauges, and KPI cards
- **Default Dev Port:** `5173`

### Backend
- **Runtime:** Python 3.10+ with FastAPI
- **Server:** Uvicorn
- **Persistence:** MongoDB Atlas (project state, reports, chat history, PPE logs, workflows)
- **Vector Search / RAG:** Qdrant + FastEmbed / Cohere embeddings
- **Document Parsing:** PyPDF, python-docx
- **PDF Export:** ReportLab
- **Environment:** python-dotenv
- **Default Dev Port:** `8001`

### AI Providers
| Provider | Role | Models |
|----------|------|--------|
| **Mistral AI** | Primary LLM for chat, reports, guardrails, risk analysis | `mistral-large-latest` |
| **Groq** | Fast text fallback | `llama-3.1-8b-instant` |
| **Google Gemini** | Vision / multimodal tasks, PPE image analysis, document understanding | `gemini-2.5-flash` |
| **Sarvam AI** | Multilingual STT (voice input) & TTS | `saaras:v4` (translate mode), `bulbul:v3` (TTS) |
| **OpenWeather** | Live weather data and forecasts | — |
| **Tavily** | Web search for contextual risk / compliance data | — |
| **Cohere** | Embeddings for RAG | — |

### MCP Server
The project relies on an external MCP server. Clone it from the repository below and run it alongside the backend:

- **Repository:** https://github.com/iamkavy47/mcpserver
- **Local path used in dev script:** `/root/mcpserver`
- **Setup:** `cd /root/mcpserver && source .venv/bin/activate && uv sync && python main.py`

---

## Features

### Core Modules

| Module | Description |
|--------|-------------|
| **Dashboard** | Project health overview, KPI gauges (CPI, SPI, safety score), recent alerts, weather widget, quick actions. |
| **Timeline Intelligence** | Interactive Gantt chart with zoom, filters, progress bars, "today" marker, phase detail panel, and AI optimization. |
| **Material Intelligence** | Track stock vs. required materials, shortage detection, AI-driven estimation triggers. |
| **Risk Intelligence** | Open risk register, AI risk analysis, **Construction Risk Intelligence Engine** (weighted score, pattern detection, incident prediction), mitigation workflow board. |
| **Safety Intelligence** | Safety incident logging, hazard register, AI safety analysis, **PPE image check** via worker photo upload. |
| **Daily Report** | AI-generated daily construction report with work done, planned work, issues, weather impact, and recommendations; exportable as audit-ready PDF. |
| **Executive View** | Board-level aggregation of risk, safety, compliance, insurance exposure, workflows, and notifications. |
| **Construction Copilot** | Multilingual AI chat with streaming text output, document upload context, and **voice input** (Sarvam STT). |

### AI & Automation
- **Guardrails:** LLM-only query classifier ensures the copilot only answers construction-related queries.
- **Document Upload Wizard:** Users upload PDF/DOCX construction documents; details are extracted to seed project info and material estimates.
- **Event Simulation:** One-click simulation of weather/material events to test AI responses.
- **Notification & Workflow:** Escalation engine with Slack/Teams webhook integration, mitigation task lifecycle (Open → In Progress → Resolved).
- **PDF Export:** Audit-ready PDF exports for daily reports and executive summaries.

---

## Project Setup

### ⚙️ Environment Variables

Before starting either deployment method (Docker or local), create a `.env` file at the project root (`/root/cih/.env`):

```bash
[ -f .env.example ] && cp .env.example .env || touch .env
# then edit .env and add your real keys
```

How `.env` is used:
- Local run: loaded by `python-dotenv` from project root.
- Docker run: pass it with `--env-file .env` (the file is not baked into the image).

### Environment File Format

```env
# --- AI Provider Keys ---
# Primary & fallback LLM keys
GROQ_API_KEY=your_groq_api_key_here
GROQ_FALLBACK_API_KEY=your_groq_fallback_api_key_here
MISTRAL_API_KEY=your_mistral_api_key_here

# Vision / multimodal / document understanding
GEMINI_API_KEY=your_gemini_api_key_here

# Web search
TAVILY_API_KEY=your_tavily_api_key_here

# Weather data
OPENWEATHER_API_KEY=your_openweather_api_key_here

# Embeddings for RAG
COHERE_API_KEY=your_cohere_api_key_here

# --- Speech (Sarvam AI) ---
# Primary + two fallback keys for automatic rotation
SARVAM_API_KEY=your_sarvam_api_key_here
SARVAM_API_KEY2=your_sarvam_fallback_key_2_here
SARVAM_API_KEY3=your_sarvam_fallback_key_3_here
SARVAM_STT_MODEL=saaras:v4
SARVAM_STT_MODE=translate
SARVAM_STT_SAMPLE_RATE=16000
SARVAM_TTS_MODEL=bulbul:v3
SARVAM_TTS_SPEAKER=soham
SARVAM_TTS_PACE=1
SARVAM_TTS_SAMPLE_RATE=22050

# --- Database ---
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=construction_intelligence_hub

# --- Qdrant (Vector DB) ---
QDRANT_URL=your_qdrant_url_here
QDRANT_API_KEY=your_qdrant_api_key_here

# --- Notifications (Optional) ---
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...
```

Frontend `.env` (`/root/cih/frontend/.env`) for local frontend dev:

```env
# Backend base URL
VITE_BACKEND_URL=http://127.0.0.1:8001

# Demo login credentials (server-side only)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=1234
SESSION_SECRET=change-me-to-a-long-random-string
```

> Replace every placeholder (`your_*_here`) with your actual key. Do not commit real API keys to version control.

### Run With Docker Compose (Recommended)

This setup avoids the MCP port conflict by exposing CIH on host port `8001`.

1. Build and start:

```bash
cd /root/cih
docker compose up -d --build
```

2. Open the app:

```text
http://127.0.0.1:8001
```

3. Useful Docker Compose commands:

```bash
# view logs
docker compose logs -f

# show running services
docker compose ps

# restart service
docker compose restart

# stop containers (keep volumes)
docker compose down

# stop and remove volumes too
docker compose down -v

# open shell in app container
docker compose exec cih sh

# rebuild after code changes
docker compose up -d --build
```

Optional: if your Docker installation uses the old command style, use
`docker-compose` instead of `docker compose`.

### Run Without Docker (Local Dev)

### 1. Start the MCP Server (if your workflow needs it)

The MCP server must be running before or alongside the backend.

```bash
git clone https://github.com/iamkavy47/mcpserver.git /root/mcpserver
cd /root/mcpserver
python -m venv .venv
source .venv/bin/activate
uv sync
python main.py
```

> The tmux workflow below starts this automatically in pane 1.

### 2. Start the Backend

```bash
cd /root/cih
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8001
```

Backend will be available at `http://127.0.0.1:8001`.

### 3. Start the Frontend (optional in dev mode)

If you want Vite hot-reload during UI development:

```bash
cd /root/cih/frontend
npm install
npm run dev
```

Then open `http://127.0.0.1:5173`.

### 4. Build Frontend For Backend-Served Mode (optional)

If you want the Python app to serve the built frontend itself:

```bash
cd /root/cih/frontend
npm ci
npm run build
```

Then run backend and open `http://127.0.0.1:8001`.

### 5. Quick Health Check

```bash
curl -I http://127.0.0.1:8001
curl http://127.0.0.1:8001/api/db/status
```

---

## Development Workflow (Tmux)

Use the following `tmux` script to launch the MCP server, Python backend, and frontend in a single session:

```bash
#!/usr/bin/env bash

SESSION="infosys"

# Attach if session already exists
if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "Session '$SESSION' already exists."
    tmux attach -t "$SESSION"
    exit 0
fi

# Create session with one window
tmux new-session -d -s "$SESSION" -n "Development"

# -------------------------------
# Pane 1 (Left): MCP Server
# Repo: https://github.com/iamkavy47/mcpserver
# -------------------------------
tmux send-keys -t "$SESSION:Development.0" \
"cd /root/mcpserver && source .venv/bin/activate && uv sync && python main.py" C-m

# -------------------------------
# Pane 2 (Top Right): Backend (port 8001)
# -------------------------------
tmux split-window -h -t "$SESSION:Development"
tmux send-keys -t "$SESSION:Development.1" \
"cd /root/cih && source .venv/bin/activate && pip install -r requirements.txt && uvicorn app:app --reload --host 0.0.0.0 --port 8001" C-m

# -------------------------------
# Pane 3 (Bottom Right): Frontend (port 5173)
# -------------------------------
tmux split-window -v -t "$SESSION:Development.1"
tmux send-keys -t "$SESSION:Development.2" \
"cd /root/cih/frontend && npm run dev" C-m

# Arrange panes nicely
tmux select-layout -t "$SESSION:Development" tiled

# Focus MCP pane
tmux select-pane -t "$SESSION:Development.0"

# Attach
tmux attach -t "$SESSION"
```

Save it as `start-dev.sh`, make it executable, and run:

```bash
chmod +x start-dev.sh
./start-dev.sh
```

This opens three panes: MCP server, FastAPI backend with auto-reload, and the Vite frontend dev server.

### Port Reference

| Service | Default Port | Configured In |
|---------|--------------|---------------|
| MCP Server | depends on `main.py` | `/root/mcpserver` |
| FastAPI Backend | `8001` | `uvicorn` command / Docker Compose |
| Vite Frontend | `5173` | `npm run dev` |

---

## Start the Frontend

```bash
cd /root/cih/frontend
npm run dev
```

## Default Login

The app uses a simple server-side session for the demo:

- **Username:** `admin`
- **Password:** `1234` (configured in `frontend/.env`)

---

## Project Structure

```
/root/cih
├── app.py                      # FastAPI backend (AI, endpoints, MongoDB, RAG)
├── requirements.txt            # Python dependencies
├── .env.example                # Environment variable template
├── README.md                   # This file
├── src/
│   ├── routes/                 # TanStack Start routes
│   │   ├── index.tsx           # Main authenticated app shell
│   │   ├── auth.tsx            # Login page
│   │   └── __root.tsx          # Root layout
│   ├── components/             # Reusable UI components
│   │   ├── modules/            # Module views (Dashboard, Risk, Safety, etc.)
│   │   ├── AppShell.tsx        # Main layout shell
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   └── Wizard.tsx          # Project onboarding wizard
│   ├── hooks/                  # TanStack Query hooks
│   ├── lib/                    # API clients, types, auth functions
│   └── styles.css              # Tailwind v4 theme tokens
└── frontend/                   # Vite frontend root
    ├── .env                    # Frontend environment variables
    └── ...
```

---

## Key API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/init-project` | Create a new project with optional document upload |
| `GET /api/state` | Fetch current project state |
| `POST /api/chat` | Multilingual streaming AI copilot |
| `POST /api/analyze-risks` | AI risk analysis |
| `POST /api/analyze-safety` | AI safety hazard analysis |
| `POST /api/analyze-ppe` | Worker PPE image compliance check |
| `POST /api/optimize-timeline` | AI timeline optimization |
| `POST /api/generate-daily-report` | AI daily report generator |
| `POST /api/risk-engine` | Weighted risk score + pattern detection |
| `POST /api/escalate/scan` | Run escalation rules and notify channels |
| `GET /api/export/daily-report` | Download daily report PDF |
| `GET /api/export/executive-summary` | Download executive summary PDF |

---

## Notes

- The **MCP server is required** for full functionality: https://github.com/iamkavy47/mcpserver
- The backend must be running locally or exposed via a tunnel (e.g., ngrok) for the frontend to connect.
- Sarvam AI keys rotate automatically; if the primary key hits a rate limit, `SARVAM_API_KEY2` and `SARVAM_API_KEY3` are tried in sequence.
- Slack/Teams notifications are optional; if webhook URLs are absent, escalations are still logged in-app and persisted to MongoDB.
- For production, replace the demo session login with a proper auth provider.

---

## Roadmap

- [x] Multi-project portfolio with MongoDB persistence
- [x] Risk Intelligence Engine with scoring & predictions
- [x] PPE image analysis via Gemini
- [x] Multilingual voice input via Sarvam STT
- [x] Audit-ready PDF exports
- [x] Executive / compliance / insurance dashboards
- [x] Notification & workflow module
- [ ] SMS/email notifications (requires Twilio / SMTP / Resend key)
- [ ] True side-by-side multi-project portfolio dashboard
- [ ] Compliance-only and Insurance-only standalone modules

