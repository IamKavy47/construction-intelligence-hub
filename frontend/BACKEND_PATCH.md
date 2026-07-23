# Backend Patch — `app.py`

Apply these edits to your FastAPI backend so the new frontend works end-to-end.
Everything below assumes you already have `MISTRAL_API_KEY`, `OPENWEATHER_API_KEY`,
`TAVILY_API_KEY` in `.env`. Add one new key: **`GROQ_API_KEY`**.

---

## 1) `.env` and `requirements.txt`

```bash
# .env  (add this line)
GROQ_API_KEY=gsk_...
```

```txt
# requirements.txt  (add these)
groq>=0.11.0
pypdf>=4.0.0
python-docx>=1.1.0
python-multipart>=0.0.9   # already there if you use UploadFile
```

---

## 2) Add a Groq fallback wrapper for every AI call

Replace your existing `call_mistral(...)` (or whatever your helper is called)
with this dual-provider version. **Model choices (confirmed with you):**
- Primary: `mistral-small-latest`
- Fallback: `llama-3.1-8b-instant` on Groq (fast, small, cheap, great for
  high-volume module calls like risk/safety/timeline/report)

```python
# ai.py  (new file, or paste into app.py near the top)
import os, json, logging
from mistralai import Mistral
from groq import Groq

log = logging.getLogger("ai")

_mistral = Mistral(api_key=os.environ["MISTRAL_API_KEY"])
_groq = Groq(api_key=os.environ["GROQ_API_KEY"]) if os.getenv("GROQ_API_KEY") else None

MISTRAL_MODEL = "mistral-small-latest"
GROQ_MODEL    = "llama-3.1-8b-instant"

def ai_chat(messages: list[dict], *, json_mode: bool = False, temperature: float = 0.3) -> str:
    """Call Mistral first; on any failure fall back to Groq llama-3.1-8b-instant."""
    kwargs = {"model": MISTRAL_MODEL, "messages": messages, "temperature": temperature}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    try:
        r = _mistral.chat.complete(**kwargs)
        return r.choices[0].message.content
    except Exception as e:
        log.warning("Mistral failed (%s) — falling back to Groq", e)
        if not _groq:
            raise
        gkwargs = {"model": GROQ_MODEL, "messages": messages, "temperature": temperature}
        if json_mode:
            gkwargs["response_format"] = {"type": "json_object"}
        r = _groq.chat.completions.create(**gkwargs)
        return r.choices[0].message.content

def ai_json(messages: list[dict], temperature: float = 0.2) -> dict:
    txt = ai_chat(messages, json_mode=True, temperature=temperature)
    try:
        return json.loads(txt)
    except json.JSONDecodeError:
        # rescue: strip fences/prose
        s = txt[txt.find("{"): txt.rfind("}") + 1]
        return json.loads(s)
```

Now **replace every direct `client.chat.complete(...)` call in `app.py`** with
`ai_chat(...)` or `ai_json(...)`. That single swap gives every module Mistral
primary + Groq fallback.

---

## 3) Remove Workforce & Equipment

Delete (or leave dormant) these endpoints and any state fields:

```python
# REMOVE these routes if you have them:
# @app.get("/api/workforce")   ...
# @app.get("/api/equipment")   ...

# Remove `equipment` and `workforce` from your PROJECT_STATE dict.
# Also strip them from any AI system prompt that lists modules.
```

`/api/get-state` should no longer return `equipment` or `workforce` keys — the
frontend has dropped them. Leaving them in is harmless but wasted tokens.

---

## 4) Wizard document upload → `/api/init-project`

Change `/api/init-project` to accept **either** JSON (as today) **or**
`multipart/form-data` with an `info` JSON field + a `document` file. When a
document is attached, extract text and feed it to the AI baseline so material
estimation, risks, and timeline are grounded in the actual construction doc.

```python
from fastapi import UploadFile, File, Form, Request
from pypdf import PdfReader
from docx import Document
import io, json

def _extract_text(file: UploadFile) -> str:
    raw = file.file.read()
    name = (file.filename or "").lower()
    if name.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(raw))
        return "\n".join((p.extract_text() or "") for p in reader.pages[:50])
    if name.endswith(".docx"):
        doc = Document(io.BytesIO(raw))
        return "\n".join(p.text for p in doc.paragraphs)
    if name.endswith((".txt", ".md")):
        return raw.decode("utf-8", errors="ignore")
    return ""

@app.post("/api/init-project")
async def init_project(request: Request):
    ctype = request.headers.get("content-type", "")
    doc_text = ""

    if ctype.startswith("multipart/form-data"):
        form = await request.form()
        info = json.loads(form["info"])
        upload: UploadFile | None = form.get("document")  # type: ignore
        if upload:
            doc_text = _extract_text(upload)[:60_000]  # cap tokens
    else:
        info = await request.json()

    # Persist the extracted summary so later AI calls can reference it
    info["docSummary"] = doc_text[:2000] if doc_text else None

    baseline = ai_json([
        {"role": "system", "content": SYSTEM_BASELINE_PROMPT},   # your existing prompt
        {"role": "user", "content": json.dumps({
            "project": info,
            "construction_document": doc_text or None,
        })},
    ])

    PROJECT_STATE["project"] = info
    PROJECT_STATE.update(baseline)   # risks, materials, timeline, safetyHazards, etc.
    return {"ok": True, "project_state": PROJECT_STATE}
```

Update `SYSTEM_BASELINE_PROMPT` to request the new fields. Minimum shape:

```json
{
  "risks":     [{ "id":"R-01","desc":"...","prob":"High","impact":"Medium","status":"Open","category":"Weather","mitigation":"...","score":8 }],
  "materials": [{ "name":"Rebar","sku":"...","supplier":"...","stock":"...","required":"...","status":"Healthy" }],
  "timeline":  [{ "name":"Superstructure","start":2,"length":2,"status":"active","progress":45,"risk":"Medium","note":"Behind by 3 days" }],
  "safetyHazards": [{ "id":"H-01","hazard":"Fall from height","location":"Level 8 slab","likelihood":"High","severity":"High","control":"Full guardrails + harness anchor points" }],
  "alerts": [{ "type":"warning","text":"..." }],
  "health": 87, "cpi": 1.02, "spi": 0.94, "safetyScore": 92, "budgetUsed": "38%"
}
```

Tell the model in the prompt: *"If a `construction_document` is provided, base
your material takeoff, safety hazards, and phase durations on the rooms,
floors, gates, windows and finishes you extract from it."*

---

## 5) New endpoints the frontend calls

```python
@app.post("/api/generate-daily-report")
def generate_daily_report():
    report = ai_json([
        {"role":"system","content":
         "You are a construction project engineer. Produce ONE Daily Progress "
         "Report (DPR) as strict JSON matching this schema: "
         "{date, summary (markdown, 2-4 sentences), progress (e.g. '45%'), "
         "workDone[], workPlanned[], issues[], weatherImpact, safetyNotes, "
         "aiRecommendations[]}."},
        {"role":"user","content": json.dumps({
            "project": PROJECT_STATE.get("project"),
            "weather": PROJECT_STATE.get("weatherReport"),
            "materials": PROJECT_STATE.get("materials"),
            "risks": PROJECT_STATE.get("risks"),
            "safety": PROJECT_STATE.get("safety"),
            "timeline": PROJECT_STATE.get("timeline"),
        })},
    ])
    PROJECT_STATE.setdefault("dailyReports", []).insert(0, report)
    return {"report": report, "project_state": PROJECT_STATE}

@app.post("/api/analyze-risks")
def analyze_risks():
    result = ai_json([
        {"role":"system","content":
         "Re-evaluate the construction risk register. Return JSON "
         "{risks:[{id,desc,prob,impact,status,category,mitigation,score}]}. "
         "Score = probability*impact (1-9). Use current weather + materials context."},
        {"role":"user","content": json.dumps({
            "project": PROJECT_STATE.get("project"),
            "current_risks": PROJECT_STATE.get("risks", []),
            "weather": PROJECT_STATE.get("weatherReport"),
            "materials": PROJECT_STATE.get("materials"),
        })},
    ])
    PROJECT_STATE["risks"] = result.get("risks", PROJECT_STATE.get("risks", []))
    return {"ok": True, "project_state": PROJECT_STATE}

@app.post("/api/analyze-safety")
def analyze_safety():
    result = ai_json([
        {"role":"system","content":
         "Predict site-specific safety hazards for TODAY based on active "
         "construction phase, weather, and past incidents. Return JSON "
         "{safetyHazards:[{id,hazard,location,likelihood,severity,control}]} "
         "with 4-8 items. Controls must be actionable."},
        {"role":"user","content": json.dumps({
            "project": PROJECT_STATE.get("project"),
            "weather": PROJECT_STATE.get("weatherReport"),
            "safety_logs": PROJECT_STATE.get("safety", []),
            "timeline": PROJECT_STATE.get("timeline"),
        })},
    ])
    PROJECT_STATE["safetyHazards"] = result.get("safetyHazards", [])
    return {"ok": True, "project_state": PROJECT_STATE}

@app.post("/api/optimize-timeline")
def optimize_timeline():
    result = ai_json([
        {"role":"system","content":
         "Re-optimize the construction schedule using weather forecast, "
         "material shortages, and open risks. Return JSON "
         "{timeline:[{name,start,length,status,progress,risk,note}]} "
         "in weeks. `risk` = Low|Medium|High. `note` explains any change."},
        {"role":"user","content": json.dumps({
            "project": PROJECT_STATE.get("project"),
            "current_timeline": PROJECT_STATE.get("timeline", []),
            "weather": PROJECT_STATE.get("weatherReport"),
            "materials": PROJECT_STATE.get("materials"),
            "risks": PROJECT_STATE.get("risks"),
        })},
    ])
    PROJECT_STATE["timeline"] = result.get("timeline", [])
    return {"ok": True, "project_state": PROJECT_STATE}
```

---

## 6) Make sure CORS still allows the preview

```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
```

---

## 7) Quick sanity checklist

- [ ] `pip install -r requirements.txt` (groq, pypdf, python-docx)
- [ ] `GROQ_API_KEY` in `.env`
- [ ] `uvicorn app:app --reload --port 8000`
- [ ] Open the frontend → wizard → upload a PDF → confirm materials/risks look
      grounded in that doc
- [ ] Kill your Mistral key temporarily → verify Groq fallback still returns
      valid JSON for `/api/analyze-risks` (check server log for "falling back to Groq")

That's the full delta. Every module now: (1) uses AI end-to-end, (2) has a
per-module "Ask AI" or "Re-analyze" button, (3) falls back to Groq
`llama-3.1-8b-instant` if Mistral fails.
