import os
import io
import json
import logging
from datetime import datetime, date
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("construction_intelligence_hub")

app = FastAPI(title="Construction Intelligence Hub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================================================
# GLOBAL STATE
# =====================================================================================
def empty_state() -> Dict[str, Any]:
    return {
        "project": None,
        "health": None,
        "cpi": None,
        "spi": None,
        "safetyScore": None,
        "budgetUsed": None,
        "alerts": [],
        "risks": [],
        "uploadedDocuments": [],
        "materials": [],
        "timeline": [],
        "safety": [],
        "safetyHazards": [],
        "dailyReports": [],
        "weatherReport": None,
        "chatHistory": [],
    }

PROJECT_STATE: Dict[str, Any] = empty_state()

# =====================================================================================
# VECTOR STORE (unchanged) — Qdrant hybrid dense+sparse with Cohere embed-v4.0
# =====================================================================================
COLLECTION_NAME = "construction_docs"
DENSE_MODEL = "embed-v4.0"
DENSE_DIM = 1024
SPARSE_MODEL = "Qdrant/bm25"

_qdrant_client = None
_sparse_model = None
_cohere_client = None
_vector_store_error: Optional[str] = None


class VectorStoreUnavailable(Exception):
    pass


def get_vector_store():
    global _qdrant_client, _sparse_model, _cohere_client, _vector_store_error

    if _qdrant_client is not None and _sparse_model is not None and _cohere_client is not None:
        return _qdrant_client, _sparse_model, _cohere_client

    cohere_key = os.getenv("COHERE_API_KEY")
    if not cohere_key:
        _vector_store_error = "COHERE_API_KEY is not set. It is required for document embeddings."
        raise VectorStoreUnavailable(_vector_store_error)

    try:
        import cohere
        from qdrant_client import QdrantClient, models
        from fastembed import SparseTextEmbedding

        _cohere_client = cohere.ClientV2(api_key=cohere_key)
        _qdrant_client = QdrantClient(path="./qdrant_db")
        _sparse_model = SparseTextEmbedding(model_name=SPARSE_MODEL)

        if not _qdrant_client.collection_exists(COLLECTION_NAME):
            _qdrant_client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config={
                    "dense": models.VectorParams(size=DENSE_DIM, distance=models.Distance.COSINE)
                },
                sparse_vectors_config={
                    "sparse": models.SparseVectorParams(modifier=models.Modifier.IDF)
                },
            )
        _vector_store_error = None
        return _qdrant_client, _sparse_model, _cohere_client
    except Exception as e:
        _qdrant_client = None
        _sparse_model = None
        _cohere_client = None
        _vector_store_error = f"Failed to initialize vector store: {e}"
        logger.error(_vector_store_error)
        raise VectorStoreUnavailable(_vector_store_error)


def _embed_dense(texts: List[str], input_type: str) -> List[List[float]]:
    _, _, cohere_client = get_vector_store()
    resp = cohere_client.embed(
        texts=texts,
        model=DENSE_MODEL,
        input_type=input_type,
        embedding_types=["float"],
        output_dimension=DENSE_DIM,
    )
    return resp.embeddings.float_


def index_document_chunks(chunks: List[str], source: str):
    from qdrant_client import models

    client, sparse_model, _ = get_vector_store()
    dense_vecs = _embed_dense(chunks, input_type="search_document")
    sparse_vecs = list(sparse_model.embed(chunks))

    points = []
    base_id = abs(hash(source)) % 1_000_000_000
    for i, (chunk, dense, sparse) in enumerate(zip(chunks, dense_vecs, sparse_vecs)):
        points.append(
            models.PointStruct(
                id=base_id + i,
                vector={
                    "dense": dense,
                    "sparse": models.SparseVector(
                        indices=sparse.indices.tolist(), values=sparse.values.tolist()
                    ),
                },
                payload={"text": chunk, "source": source},
            )
        )
    client.upsert(collection_name=COLLECTION_NAME, points=points)


def hybrid_search(query: str, k: int = 5) -> List[Dict[str, str]]:
    from qdrant_client import models

    client, sparse_model, _ = get_vector_store()
    dense_vec = _embed_dense([query], input_type="search_query")[0]
    sparse_vec = next(iter(sparse_model.embed([query])))

    results = client.query_points(
        collection_name=COLLECTION_NAME,
        prefetch=[
            models.Prefetch(query=dense_vec, using="dense", limit=k * 2),
            models.Prefetch(
                query=models.SparseVector(
                    indices=sparse_vec.indices.tolist(), values=sparse_vec.values.tolist()
                ),
                using="sparse",
                limit=k * 2,
            ),
        ],
        query=models.FusionQuery(fusion=models.Fusion.RRF),
        limit=k,
    )
    return [
        {"source": pt.payload.get("source", "Document"), "text": pt.payload.get("text", "")}
        for pt in results.points
    ]


# =====================================================================================
# DOCUMENT TEXT EXTRACTION (used by wizard + /api/upload)
# =====================================================================================
def extract_text_from_bytes(filename: str, raw: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(raw))
        return "\n".join((p.extract_text() or "") for p in reader.pages[:50])
    if name.endswith(".docx"):
        from docx import Document as DocxDocument
        doc = DocxDocument(io.BytesIO(raw))
        return "\n".join(p.text for p in doc.paragraphs)
    if name.endswith((".txt", ".md", ".csv")):
        return raw.decode("utf-8", errors="ignore")
    if name.endswith(".doc"):
        raise HTTPException(400, "Legacy .doc is not supported. Please upload .docx, .pdf, .txt, or .md.")
    return ""


# =====================================================================================
# PYDANTIC SCHEMAS
# =====================================================================================
class ProjectInfo(BaseModel):
    projectName: str
    client: str = ""
    location: str = ""
    projectType: str = ""
    floors: int = 0
    builtArea: float = 0.0
    structuralSystem: str = ""
    startDate: str = ""
    completionDate: str = ""
    shiftCount: str = ""
    aiRisk: bool = True
    aiWeather: bool = True
    aiDocs: bool = True

class ChatPayload(BaseModel):
    message: str
    active_module: str

class SimulatePayload(BaseModel):
    type: Optional[str] = None  # 'weather' or 'material'

# =====================================================================================
# AGENT TOOLS
# =====================================================================================
from langchain_core.tools import tool

@tool
def weather_lookup(location: str) -> str:
    """Gets current weather and 5-day forecast for a construction site via OpenWeather."""
    api_key = os.getenv("OPENWEATHER_API_KEY")
    if not api_key:
        return "OpenWeather API key is not configured (OPENWEATHER_API_KEY)."

    logger.info(f"Tool: weather_lookup({location})")
    geocode_url = f"http://api.openweathermap.org/geo/1.0/direct?q={location}&limit=1&appid={api_key}"
    try:
        geo_res = requests.get(geocode_url, timeout=10).json()
        if not geo_res:
            return f"Could not find coordinates for location: {location}."
        lat, lon = geo_res[0]["lat"], geo_res[0]["lon"]
    except Exception as e:
        return f"Error resolving coordinates: {str(e)}"

    weather_url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&units=metric&appid={api_key}"
    forecast_url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&units=metric&appid={api_key}"

    try:
        w_data = requests.get(weather_url, timeout=10).json()
        f_data = requests.get(forecast_url, timeout=10).json()

        temp = w_data.get("main", {}).get("temp", "N/A")
        desc = w_data.get("weather", [{}])[0].get("description", "N/A")
        wind = w_data.get("wind", {}).get("speed", "N/A")
        humidity = w_data.get("main", {}).get("humidity", "N/A")

        forecast_days = []
        seen_dates = set()
        for item in f_data.get("list", []):
            dt_txt = item.get("dt_txt", "")
            if not dt_txt:
                continue
            d, t = dt_txt.split(" ")
            if "12:00:00" in t and d not in seen_dates:
                seen_dates.add(d)
                f_temp = item.get("main", {}).get("temp", "N/A")
                f_desc = item.get("weather", [{}])[0].get("description", "N/A")
                f_wind = item.get("wind", {}).get("speed", "N/A")
                risk = "Crane Risk" if isinstance(f_wind, (int, float)) and f_wind > 8.3 else (
                    "Crane Risk" if "storm" in f_desc.lower() or "thunder" in f_desc.lower() else "Clear"
                )
                icon = "cloud-lightning" if risk == "Crane Risk" else ("cloud" if "cloud" in f_desc.lower() else "sun")
                forecast_days.append({
                    "day": d, "temp": round(f_temp) if isinstance(f_temp, (int, float)) else f_temp,
                    "desc": f_desc.capitalize(), "icon": icon, "risk": risk, "wind": f_wind
                })

        PROJECT_STATE["weatherReport"] = {
            "temp": round(temp) if isinstance(temp, (int, float)) else temp,
            "desc": str(desc).capitalize(),
            "wind": f"{wind} m/s",
            "humidity": f"{humidity}%",
            "location": location,
            "updatedAt": datetime.utcnow().isoformat(),
            "forecast": forecast_days,
        }

        report = f"WEATHER FOR {location.upper()}:\nCurrent: {temp}°C, {str(desc).capitalize()}\nWind: {wind} m/s, Humidity: {humidity}%\n"
        if forecast_days:
            report += "Forecast:\n" + "\n".join(f"- {d['day']}: {d['temp']}°C, {d['desc']} (risk: {d['risk']})" for d in forecast_days)
        return report
    except Exception as e:
        return f"Error retrieving weather: {str(e)}"


@tool
def web_search(query: str) -> str:
    """Searches the web via Tavily for construction standards, codes, or pricing."""
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return "Tavily API key is not configured (TAVILY_API_KEY)."

    logger.info(f"Tool: web_search({query})")
    try:
        res = requests.post(
            "https://api.tavily.com/search",
            json={"api_key": api_key, "query": query, "max_results": 3},
            timeout=15,
        ).json()
        formatted = [
            f"Title: {r.get('title')}\nURL: {r.get('url')}\nSnippet: {r.get('content')}\n"
            for r in res.get("results", [])
        ]
        return "\n".join(formatted) if formatted else "No web results found."
    except Exception as e:
        return f"Error in web search: {str(e)}"


@tool
def get_project_data(category: str) -> str:
    """Reads current project state.
    category: 'all', 'metrics', 'materials', 'timeline', 'safety', 'safetyHazards', 'risks', 'weather'."""
    logger.info(f"Tool: get_project_data({category})")
    if category == "all":
        return json.dumps({k: v for k, v in PROJECT_STATE.items() if k != "chatHistory"}, indent=2, default=str)
    if category == "metrics":
        return json.dumps({
            "health": PROJECT_STATE.get("health"),
            "cpi": PROJECT_STATE.get("cpi"),
            "spi": PROJECT_STATE.get("spi"),
            "safetyScore": PROJECT_STATE.get("safetyScore"),
            "budgetUsed": PROJECT_STATE.get("budgetUsed"),
        }, indent=2)
    if category == "weather":
        return json.dumps(PROJECT_STATE.get("weatherReport") or "No weather report yet.", indent=2)
    if category in PROJECT_STATE:
        return json.dumps(PROJECT_STATE[category], indent=2, default=str)
    return f"Unknown category '{category}'."


_NEW_ITEM_TEMPLATES = {
    "materials": lambda kid: {"name": kid, "sku": kid, "supplier": "TBD", "stock": "0", "required": "0", "status": "Estimating"},
    "timeline": lambda kid: {"name": kid, "start": 0, "length": 1, "status": "planned", "progress": 0, "risk": "Low", "note": ""},
    "risks": lambda kid: {"id": kid, "desc": "", "prob": "Medium", "impact": "Medium", "status": "New", "category": "General", "mitigation": "", "score": 4},
    "safety": lambda kid: {"id": kid, "date": date.today().isoformat(), "type": "Incident", "location": "Site Wide", "desc": "", "severity": "Medium"},
    "safetyHazards": lambda kid: {"id": kid, "hazard": "", "location": "Site Wide", "likelihood": "Medium", "severity": "Medium", "control": ""},
}

@tool
def update_project_data(category: str, key_or_id: str, field: str, value: str) -> str:
    """Creates or updates an item in the live project database.
    category: 'metrics', 'materials', 'timeline', 'safety', 'safetyHazards', 'risks'.
    For 'metrics', key_or_id is metric name (health, cpi, spi, safetyScore, budgetUsed).
    For lists, key_or_id is the identifier (sku for materials, name for timeline, id for others)."""
    logger.info(f"Tool: update_project_data({category}, {key_or_id}, {field}, {value})")
    try:
        if category == "metrics":
            if key_or_id == "health":
                PROJECT_STATE["health"] = int(float(value))
            elif key_or_id == "cpi":
                PROJECT_STATE["cpi"] = round(float(value), 2)
            elif key_or_id == "spi":
                PROJECT_STATE["spi"] = round(float(value), 2)
            elif key_or_id == "safetyScore":
                PROJECT_STATE["safetyScore"] = int(float(value))
            elif key_or_id == "budgetUsed":
                PROJECT_STATE["budgetUsed"] = str(value)
            else:
                return f"Error: Metric '{key_or_id}' does not exist."
            return f"Success: Metric '{key_or_id}' -> {value}."

        if category not in _NEW_ITEM_TEMPLATES:
            return f"Error: Category '{category}' cannot be modified dynamically."

        items = PROJECT_STATE.setdefault(category, [])
        id_field = {"materials": "sku", "timeline": "name"}.get(category, "id")

        for item in items:
            if item.get(id_field) == key_or_id:
                old_val = item.get(field)
                if isinstance(old_val, bool):
                    item[field] = str(value).lower() in ("true", "1", "yes")
                elif isinstance(old_val, int):
                    item[field] = int(float(value))
                elif isinstance(old_val, float):
                    item[field] = float(value)
                else:
                    item[field] = value
                return f"Success: Updated {category} '{key_or_id}'.{field} = '{value}'."

        new_item = _NEW_ITEM_TEMPLATES[category](key_or_id)
        new_item[field] = value
        items.append(new_item)
        return f"Success: Created new {category} '{key_or_id}' with {field}='{value}'."
    except Exception as e:
        return f"Error: {str(e)}"


@tool
def add_alert(alert_type: str, text: str) -> str:
    """Adds an alert to the dashboard feed. alert_type: 'success', 'warning', 'danger'."""
    logger.info(f"Tool: add_alert({alert_type}, {text})")
    if alert_type not in ("success", "warning", "danger"):
        alert_type = "warning"
    PROJECT_STATE["alerts"].insert(0, {"type": alert_type, "text": text})
    PROJECT_STATE["alerts"] = PROJECT_STATE["alerts"][:20]
    return "Success: Alert added."


@tool
def vector_store_retrieval(query: str) -> str:
    """Searches indexed drawings/specs/RFIs (Qdrant hybrid search) for technical questions."""
    logger.info(f"Tool: vector_store_retrieval({query})")
    try:
        docs = hybrid_search(query, k=5)
    except VectorStoreUnavailable as e:
        return f"Vector search unavailable: {str(e)}"
    except Exception as e:
        return f"Vector search error: {str(e)}"

    if not docs:
        return "No matching document context found."

    cohere_key = os.getenv("COHERE_API_KEY")
    if cohere_key:
        try:
            import cohere
            co = cohere.ClientV2(api_key=cohere_key)
            rerank_res = co.rerank(
                model="rerank-v3.5",
                query=query,
                documents=[d["text"] for d in docs],
                top_n=min(3, len(docs)),
            )
            docs = [docs[r.index] for r in rerank_res.results]
        except Exception as re:
            logger.warning(f"Cohere reranking skipped: {re}")

    return "\n---\n".join(f"[Source: {d['source']}]\nContent:\n{d['text']}\n" for d in docs)


ALL_TOOLS = [weather_lookup, web_search, get_project_data, update_project_data, add_alert, vector_store_retrieval]
TOOLS_BY_NAME = {t.name: t for t in ALL_TOOLS}

# =====================================================================================
# LLM WITH GROQ FALLBACK
# Primary:  Mistral  (mistral-large-latest for the tool-calling agent,
#                     mistral-small-latest for structured JSON module calls)
# Fallback: Groq llama-3.1-8b-instant (fast, small, cheap, tool-calling capable)
# =====================================================================================
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage
import operator
from typing import Sequence, TypedDict, Annotated
from langgraph.graph import StateGraph, END


class AgentUnavailable(Exception):
    pass


def _get_llm():
    """Return a tool-bound LLM with Groq fallback wired in via LangChain."""
    from langchain_mistralai import ChatMistralAI

    mistral_key = os.getenv("MISTRAL_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")

    if not mistral_key and not groq_key:
        raise AgentUnavailable("Neither MISTRAL_API_KEY nor GROQ_API_KEY is set.")

    primary = None
    if mistral_key:
        primary = ChatMistralAI(
            model="mistral-large-latest",
            temperature=0.2,
            mistral_api_key=mistral_key,
        ).bind_tools(ALL_TOOLS)

    fallback = None
    if groq_key:
        try:
            from langchain_groq import ChatGroq
            fallback = ChatGroq(
                model="llama-3.1-8b-instant",
                temperature=0.2,
                groq_api_key=groq_key,
            ).bind_tools(ALL_TOOLS)
        except Exception as e:
            logger.warning(f"Groq LLM init failed: {e}")

    if primary and fallback:
        return primary.with_fallbacks([fallback])
    return primary or fallback


# --------- Structured JSON helper (used by module endpoints) with Groq fallback -------
def ai_json(messages: List[Dict[str, str]], temperature: float = 0.2) -> Dict[str, Any]:
    """Call Mistral (small) for a JSON response; on failure fall back to Groq llama-3.1-8b-instant."""
    mistral_key = os.getenv("MISTRAL_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")

    def _parse(txt: str) -> Dict[str, Any]:
        try:
            return json.loads(txt)
        except json.JSONDecodeError:
            s = txt[txt.find("{"): txt.rfind("}") + 1]
            return json.loads(s)

    last_err = None
    if mistral_key:
        try:
            from mistralai import Mistral
            client = Mistral(api_key=mistral_key)
            r = client.chat.complete(
                model="mistral-small-latest",
                messages=messages,
                temperature=temperature,
                response_format={"type": "json_object"},
            )
            return _parse(r.choices[0].message.content)
        except Exception as e:
            last_err = e
            logger.warning(f"Mistral JSON failed ({e}); trying Groq fallback.")

    if groq_key:
        try:
            from groq import Groq
            client = Groq(api_key=groq_key)
            r = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=messages,
                temperature=temperature,
                response_format={"type": "json_object"},
            )
            return _parse(r.choices[0].message.content)
        except Exception as e:
            last_err = e
            logger.error(f"Groq JSON fallback failed: {e}")

    raise AgentUnavailable(f"AI JSON call failed. Last error: {last_err}")


# =====================================================================================
# GUARDRAILS — 3-layer topic filter (regex -> Groq classifier -> system-prompt wrapper)
# Blocks off-topic queries instantly to protect token budget.
# =====================================================================================
import re
from functools import lru_cache

REFUSAL = (
    "I'm the Construction Intelligence Hub assistant. I can only help with construction "
    "topics: project timeline, materials, risks, safety, daily reports, weather impact, "
    "site documents, standards, and codes. Please rephrase your question around the project."
)

GUARDRAIL_SYSTEM = (
    "STRICT SCOPE: You ONLY answer questions about construction, civil engineering, "
    "architecture, building materials, project management (timeline/cost/risk/safety), "
    "site weather impact, and the uploaded project documents. If the user asks about "
    "anything else (code help unrelated to construction, recipes, medicine, celebrities, "
    "general trivia, politics, entertainment, personal advice), you MUST refuse with "
    f"exactly this message and nothing else: \"{REFUSAL}\""
)

# Layer 0 — regex fast-path (0 tokens)
_BLOCK_PATTERNS = re.compile(
    r"\b(recipe|cook|bake|movie|song|lyrics|celebrity|actor|actress|"
    r"politic|election|president|stock price|crypto|bitcoin|"
    r"medicine|medical|diagnose|symptom|disease|"
    r"dating|romance|relationship advice|"
    r"write.*(poem|story|essay|novel)|"
    r"python code|javascript code|leetcode|homework)\b",
    re.IGNORECASE,
)
_ALLOW_PATTERNS = re.compile(
    r"\b(construct|build|project|site|material|concrete|steel|rebar|cement|brick|"
    r"timeline|schedule|gantt|task|milestone|risk|hazard|safety|ppe|osha|"
    r"foundation|floor|roof|wall|column|beam|slab|window|door|gate|room|area|"
    r"contractor|architect|engineer|blueprint|drawing|rfi|spec|code|standard|"
    r"budget|cost|cpi|spi|delay|weather|rain|wind|storm|report|daily|inspection|"
    r"procurement|supplier|estimate|quantity|takeoff|dashboard|copilot|kpi|alert)\b",
    re.IGNORECASE,
)

def _regex_verdict(text: str) -> Optional[bool]:
    """Return True=on-topic, False=off-topic, None=unsure."""
    if _BLOCK_PATTERNS.search(text):
        return False
    if _ALLOW_PATTERNS.search(text):
        return True
    return None


# Layer 1 — LangChain ChatGroq classifier (cheap, cached)
@lru_cache(maxsize=512)
def _groq_classify(text: str) -> bool:
    groq_key = os.getenv("GROQ_API_KEY")
    if not groq_key:
        # If Groq isn't available, be permissive (Layer 2 still guards output).
        return True
    try:
        from langchain_groq import ChatGroq
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import PydanticOutputParser
        from pydantic import BaseModel as PydBase, Field

        class TopicCheck(PydBase):
            on_topic: bool = Field(description="True if about construction/architecture/civil eng/project mgmt/site safety, else False")

        parser = PydanticOutputParser(pydantic_object=TopicCheck)
        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "Classify if the user query is about construction, civil engineering, "
             "architecture, building materials, project management (timeline/cost/risk/safety), "
             "site weather, or uploaded construction documents. Reply ONLY as JSON.\n{fmt}"),
            ("user", "{q}"),
        ]).partial(fmt=parser.get_format_instructions())

        llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0, groq_api_key=groq_key, max_tokens=80)
        chain = prompt | llm | parser
        result: TopicCheck = chain.invoke({"q": text})
        return bool(result.on_topic)
    except Exception as e:
        logger.warning(f"Groq classifier failed, allowing through: {e}")
        return True


def is_on_topic(text: str) -> bool:
    if not text or not text.strip():
        return False
    verdict = _regex_verdict(text)
    if verdict is not None:
        return verdict
    return _groq_classify(text.strip().lower())




# ===================== LANGGRAPH AGENT ================================================
class GraphState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    active_module: str


def agent_node(state: GraphState):
    messages = state["messages"]
    active_module = state["active_module"]
    llm_with_tools = _get_llm()
    if llm_with_tools is None:
        raise AgentUnavailable("No AI provider available (Mistral + Groq both missing).")

    system_prompt = SystemMessage(content=(
        GUARDRAIL_SYSTEM + "\n\n"

        "You are the core AI engine of the Construction Intelligence Hub. The user is JD "
        "(Principal Architect). Active module: "
        f"{active_module}.\nProject info: {json.dumps(PROJECT_STATE.get('project'))}\n\n"
        "Modules available: dashboard, timeline, material, risk, safety, report (daily report), copilot. "
        "There is no separate Weather module -- weather intelligence feeds Risk and Safety. "
        "There is NO workforce or equipment module.\n\n"
        "CROSS-MODULE RULES:\n"
        "- Every change must be persisted via update_project_data BEFORE you reply.\n"
        "- Weather hazards (wind > 30 km/h, storm/thunder): add a risk, add a safetyHazards entry, "
        "add an alert, slightly reduce SPI, and adjust timeline task 'risk' to High where relevant.\n"
        "- Material shortages: update material status/stock, add a risk, add an alert, adjust CPI/SPI.\n"
        "- Use get_project_data to read state before relative changes.\n"
        "- Use vector_store_retrieval for questions about uploaded drawings/specs/RFIs.\n"
        "- Use web_search for standards, codes, market pricing.\n"
        "- Use weather_lookup for real-time site weather.\n"
        "Reply briefly in Markdown, ending with a short bullet list of the DB updates you actually made."
    ))

    response = llm_with_tools.invoke([system_prompt] + list(messages))
    return {"messages": [response]}


def call_tool_node(state: GraphState):
    messages = state["messages"]
    last_message = messages[-1]
    tool_outputs = []
    if not getattr(last_message, "tool_calls", None):
        return {"messages": []}

    for tool_call in last_message.tool_calls:
        name, args, tool_id = tool_call["name"], tool_call["args"], tool_call["id"]
        logger.info(f"Invoking tool: {name} with {args}")
        if name in TOOLS_BY_NAME:
            try:
                result = TOOLS_BY_NAME[name].invoke(args)
            except Exception as e:
                result = f"Error executing tool {name}: {str(e)}"
        else:
            result = f"Tool '{name}' is not registered."
        tool_outputs.append(ToolMessage(content=str(result), tool_call_id=tool_id, name=name))

    return {"messages": tool_outputs}


def should_continue(state: GraphState):
    last_message = state["messages"][-1]
    if getattr(last_message, "tool_calls", None):
        return "tools"
    return "end"


workflow = StateGraph(GraphState)
workflow.add_node("agent", agent_node)
workflow.add_node("tools", call_tool_node)
workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", "end": END})
workflow.add_edge("tools", "agent")
compiled_graph = workflow.compile()


def run_agent(prompt: str, active_module: str) -> str:
    result = compiled_graph.invoke({
        "messages": [HumanMessage(content=prompt)],
        "active_module": active_module,
    }, config={"recursion_limit": 25})
    return result["messages"][-1].content


# =====================================================================================
# SAFETY KPIs
# =====================================================================================
def compute_safety_kpis() -> Dict[str, Any]:
    logs = PROJECT_STATE.get("safety", [])
    incidents = [l for l in logs if l.get("type") not in ("Audit",)]
    audits = [l for l in logs if l.get("type") == "Audit"]
    high_sev = [l for l in incidents if l.get("severity") == "High"]

    days_since_start = None
    project = PROJECT_STATE.get("project")
    if project and project.get("startDate"):
        try:
            start = datetime.fromisoformat(project["startDate"]).date()
            days_since_start = (date.today() - start).days
        except Exception:
            pass

    return {
        "totalIncidentsLogged": len(incidents),
        "highSeverityIncidents": len(high_sev),
        "auditsLogged": len(audits),
        "daysSinceProjectStart": days_since_start,
        "hasLostTimeIncident": len(high_sev) > 0,
    }


# =====================================================================================
# API ROUTES
# =====================================================================================
@app.post("/api/init-project")
async def init_project(request: Request):
    """Initializes a new project. Accepts EITHER application/json OR multipart/form-data
    with an `info` JSON field and an optional `document` file (PDF/DOCX/TXT/MD) — when
    a document is attached, its extracted text is fed into the AI baseline so material
    takeoff, risks, safety hazards, and timeline are grounded in the actual construction doc."""
    global PROJECT_STATE

    ctype = (request.headers.get("content-type") or "").lower()
    doc_text = ""
    doc_filename = None

    if "multipart/form-data" in ctype:
        form = await request.form()
        info_raw = form.get("info")
        if not info_raw:
            raise HTTPException(422, "Missing 'info' field in form data.")
        try:
            info_dict = json.loads(info_raw)
        except json.JSONDecodeError as e:
            raise HTTPException(422, f"'info' is not valid JSON: {e}")

        upload = form.get("document")
        if isinstance(upload, UploadFile):
            raw = await upload.read()
            if len(raw) > 15 * 1024 * 1024:
                raise HTTPException(413, "Document too large (max 15MB).")
            doc_filename = upload.filename
            try:
                doc_text = extract_text_from_bytes(doc_filename or "", raw)[:60_000]
            except HTTPException:
                raise
            except Exception as e:
                logger.exception("Doc extraction failed")
                raise HTTPException(400, f"Could not read {doc_filename}: {e}")
    else:
        info_dict = await request.json()

    try:
        info = ProjectInfo(**info_dict)
    except Exception as e:
        raise HTTPException(422, f"Invalid project info: {e}")

    logger.info(f"Initializing new project: {info.projectName} (doc: {doc_filename})")
    PROJECT_STATE = empty_state()
    project_payload = info.model_dump()
    project_payload["docSummary"] = doc_text[:2000] if doc_text else None
    project_payload["docFilename"] = doc_filename
    PROJECT_STATE["project"] = project_payload

    # Reset vector store collection
    try:
        client, _, _ = get_vector_store()
        if client.collection_exists(COLLECTION_NAME):
            client.delete_collection(COLLECTION_NAME)
        get_vector_store()
        if doc_text.strip():
            try:
                from langchain_text_splitters import RecursiveCharacterTextSplitter
                splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=100)
                chunks = splitter.split_text(doc_text)
                index_document_chunks(chunks, doc_filename or "construction_document")
                logger.info(f"Indexed {len(chunks)} chunks from the wizard document.")
            except Exception as e:
                logger.warning(f"Wizard doc indexing failed: {e}")
    except VectorStoreUnavailable as e:
        logger.warning(f"Vector store not reset: {e}")

    doc_block = ""
    if doc_text:
        doc_block = (
            f"\n\nCONSTRUCTION DOCUMENT ATTACHED ('{doc_filename}'). Extract from it: room list, "
            f"floor plates, gates, windows, finishes, area breakdown. Use these numbers as ground truth "
            f"for the material takeoff, timeline durations, and safety hazards.\n"
            f"--- BEGIN DOCUMENT ---\n{doc_text[:12000]}\n--- END DOCUMENT ---\n"
        )

    prompt = (
        f"SYSTEM: A new project was created:\n{json.dumps(info.model_dump(), indent=2)}\n"
        f"{doc_block}\n"
        "Generate the initial project baseline. Use update_project_data (and add_alert) to actually write each item:\n"
        "1. MATERIAL TAKEOFF (category='materials'): 5-8 line items sized to the floors/built area and, "
        "when the construction document is provided, to the rooms/finishes it lists. Use rules-of-thumb "
        "(RC frame: ~80-140 kg rebar/m², ~0.35-0.55 m³ concrete/m²; adjust for Steel/Composite/Precast). "
        "Set fields: name, supplier, stock='0', required (qty + units), status='Estimating'.\n"
        "2. TIMELINE (category='timeline'): 5-8 phases (e.g. Foundations, Superstructure, MEP Rough-in, "
        "Envelope, Interior Fit-out, Finishes, Commissioning). For each: start (week offset), length "
        "(weeks), status='planned', progress=0, risk='Low'|'Medium'|'High', note.\n"
        "3. RISK REGISTER (category='risks'): 3-5 realistic risks with prob, impact, category, "
        "mitigation, score (1-9 = prob*impact).\n"
        "4. SAFETY HAZARDS (category='safetyHazards'): 3-5 site-specific hazards with hazard, location, "
        "likelihood, severity, control (actionable).\n"
        "5. METRICS (category='metrics'): health=95, cpi=1.0, spi=1.0, safetyScore=100, budgetUsed='0%'.\n"
        "6. add_alert('success', 'AI baseline generated from wizard doc' if doc provided else 'AI baseline ready').\n"
        "Reply with a short summary of what you created."
    )

    try:
        run_agent(prompt, active_module="dashboard")
    except AgentUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Baseline generation failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI baseline failed: {e}")

    return {"status": "success", "message": f"Project {info.projectName} initialized.", "project_state": PROJECT_STATE}


@app.get("/api/get-state")
def get_state():
    state = dict(PROJECT_STATE)
    state["safetyKpis"] = compute_safety_kpis()
    return state


@app.post("/api/chat")
def chat_copilot(payload: ChatPayload):
    logger.info(f"User: {payload.message} (module: {payload.active_module})")

    # Layer 0/1 guardrail — short-circuit before any Mistral call (token protection)
    if not is_on_topic(payload.message):
        logger.info("Guardrail blocked off-topic query.")
        PROJECT_STATE["chatHistory"].append({"role": "user", "text": payload.message})
        PROJECT_STATE["chatHistory"].append({"role": "bot", "text": REFUSAL})
        return {"status": "blocked", "response": REFUSAL, "project_state": PROJECT_STATE}



    messages = []
    for msg in PROJECT_STATE["chatHistory"][-10:]:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["text"]))
        elif msg["role"] == "bot":
            messages.append(AIMessage(content=msg["text"]))

    PROJECT_STATE["chatHistory"].append({"role": "user", "text": payload.message})

    try:
        result = compiled_graph.invoke({
            "messages": messages + [HumanMessage(content=payload.message)],
            "active_module": payload.active_module,
        }, config={"recursion_limit": 25})
        ai_response = result["messages"][-1].content
    except AgentUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Chat failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI engine error: {e}")

    PROJECT_STATE["chatHistory"].append({"role": "bot", "text": ai_response})
    return {"status": "success", "response": ai_response, "project_state": PROJECT_STATE}


@app.post("/api/upload")
def upload_document(
    file: UploadFile = File(...),
    projectName: str = Form(""),
    client: str = Form(""),
    location: str = Form(""),
):
    filename = file.filename or "upload.bin"
    logger.info(f"Uploading: {filename}")
    contents = file.file.read()
    ext = filename.split(".")[-1].lower()

    try:
        if ext in ("pdf", "docx", "txt", "md", "csv"):
            text_content = extract_text_from_bytes(filename, contents)
        elif ext in ("xlsx", "xls"):
            import pandas as pd
            df = pd.read_excel(io.BytesIO(contents))
            text_content = df.to_string()
        elif ext in ("dwg", "dxf"):
            text_content = ""
        else:
            text_content = ""
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse {ext}: {e}")

    bytes_len = len(contents)
    if bytes_len < 1024:
        size_lbl = f"{bytes_len} B"
    elif bytes_len < 1024 * 1024:
        size_lbl = f"{(bytes_len/1024):.1f} KB"
    else:
        size_lbl = f"{(bytes_len/(1024*1024)):.1f} MB"

    types = {"pdf": "PDF Document", "doc": "Word Document", "docx": "Word Document",
             "dwg": "CAD Drawing", "dxf": "CAD Drawing", "xls": "Spreadsheet",
             "xlsx": "Spreadsheet", "png": "Image", "jpg": "Image", "jpeg": "Image",
             "csv": "Data File", "txt": "Text Document", "md": "Text Document"}
    file_type = types.get(ext, "Document")

    doc_record = {
        "id": f"DOC-{int(os.urandom(3).hex(), 16) % 100000:05d}",
        "name": filename, "size": size_lbl, "type": file_type,
        "uploadedAt": datetime.utcnow().isoformat(),
    }
    PROJECT_STATE["uploadedDocuments"].insert(0, doc_record)
    PROJECT_STATE["chatHistory"].append({"role": "user", "text": f"Uploaded document: {filename}", "attachment": doc_record})

    indexing_note = ""
    if len(text_content.strip()) > 50:
        try:
            from langchain_text_splitters import RecursiveCharacterTextSplitter
            splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=100)
            chunks = splitter.split_text(text_content)
            index_document_chunks(chunks, filename)
            indexing_note = f"Indexed {len(chunks)} chunks into Qdrant hybrid search."
        except VectorStoreUnavailable as e:
            indexing_note = f"Vector store unavailable: {e}"
        except Exception as e:
            logger.error(f"Indexing error: {e}")
            indexing_note = f"Indexing failed: {e}"
    elif ext in ("dwg", "dxf"):
        indexing_note = "CAD parser not wired up; only metadata recorded."
    else:
        indexing_note = "No extractable text; not indexed."

    prompt = (
        f"A document was uploaded: '{filename}' ({file_type}).\n"
        f"Indexing status: {indexing_note}\n"
    )
    if text_content.strip():
        prompt += f"Extracted text (truncated):\n{text_content[:2000]}\n\n"
    prompt += "Give a short, honest analysis. If nothing could be extracted, say so plainly."

    try:
        ai_response = run_agent(prompt, active_module="copilot")
    except AgentUnavailable as e:
        ai_response = f"⚠️ **AI engine unavailable:** {e}"
    except Exception as e:
        logger.error(f"Upload analysis failed: {e}")
        ai_response = f"⚠️ **Stored, but AI analysis failed:** {e}"

    PROJECT_STATE["chatHistory"].append({"role": "bot", "text": ai_response})
    return {"status": "success", "attachment": doc_record, "analysis": ai_response, "project_state": PROJECT_STATE}


@app.post("/api/simulate-event")
def simulate_event(payload: SimulatePayload):
    event_type = payload.type or ("weather" if os.urandom(1)[0] % 2 == 0 else "material")
    logger.info(f"Simulating: {event_type}")

    location = (PROJECT_STATE.get("project") or {}).get("location") or "the project site"
    if event_type == "weather":
        prompt = (
            f"SYSTEM SIMULATION: Simulate a severe weather event at {location}. "
            "Call weather_lookup for real current conditions. Then treat it as a storm/high-wind scenario: "
            "(1) add a weather-delay risk, (2) add a safetyHazards entry for the affected zone, "
            "(3) add a danger alert, (4) slightly decrease SPI, (5) raise the risk field on the currently "
            "active timeline phase. Summarize what you did."
        )
    else:
        prompt = (
            "SYSTEM SIMULATION: Simulate a material supply shortage. Pick one existing material (or propose "
            "one if none exist) and: (1) mark status 'Shortage Risk' and reduce stock, (2) add a risk about "
            "cost/schedule escalation, (3) add a danger alert, (4) slightly decrease CPI and/or SPI. Summarize."
        )

    try:
        ai_response = run_agent(prompt, active_module="dashboard")
    except AgentUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Simulation failed: {e}")
        raise HTTPException(status_code=502, detail=f"Simulation failed: {e}")

    PROJECT_STATE["chatHistory"].append({"role": "bot", "text": f"🤖 **AI Event Simulation:** {ai_response}"})
    return {"status": "success", "event_type": event_type, "response": ai_response, "project_state": PROJECT_STATE}


@app.post("/api/refresh-weather")
def refresh_weather():
    location = (PROJECT_STATE.get("project") or {}).get("location")
    if not location:
        raise HTTPException(status_code=400, detail="No project location set yet.")

    prompt = (
        f"Call weather_lookup for '{location}'. If wind > 30 km/h or storm/rain forecast, update the "
        "Risk register and safetyHazards accordingly via update_project_data, and add an alert. "
        "Otherwise just report the conditions."
    )
    try:
        ai_response = run_agent(prompt, active_module="risk")
    except AgentUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Weather refresh failed: {e}")
        raise HTTPException(status_code=502, detail=f"Weather refresh failed: {e}")

    return {"status": "success", "response": ai_response, "project_state": PROJECT_STATE}


@app.post("/api/estimate-materials")
def estimate_materials():
    project = PROJECT_STATE.get("project")
    if not project:
        raise HTTPException(status_code=400, detail="No active project.")

    doc_hint = ""
    if project.get("docSummary"):
        doc_hint = f"\nGround the estimate in this construction document summary:\n{project['docSummary']}\n"

    prompt = (
        f"Re-estimate the material takeoff for this project:\n{json.dumps({k:v for k,v in project.items() if k!='docSummary'}, indent=2)}\n"
        f"{doc_hint}"
        "Use get_project_data('materials') to see current items, then update_project_data(category='materials', ...) "
        "to add missing lines or correct quantities. Summarize what changed."
    )
    try:
        ai_response = run_agent(prompt, active_module="material")
    except AgentUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Material estimation failed: {e}")
        raise HTTPException(status_code=502, detail=f"Material estimation failed: {e}")

    return {"status": "success", "response": ai_response, "project_state": PROJECT_STATE}


# =====================================================================================
# NEW AI MODULE ENDPOINTS — Daily Report, Risk, Safety, Timeline
# All use ai_json() so they get Mistral primary + Groq llama-3.1-8b-instant fallback.
# =====================================================================================
@app.post("/api/generate-daily-report")
def generate_daily_report():
    if not PROJECT_STATE.get("project"):
        raise HTTPException(400, "No active project.")

    context = {
        "project": PROJECT_STATE.get("project"),
        "weather": PROJECT_STATE.get("weatherReport"),
        "materials": PROJECT_STATE.get("materials"),
        "risks": PROJECT_STATE.get("risks"),
        "safety": PROJECT_STATE.get("safety"),
        "safetyHazards": PROJECT_STATE.get("safetyHazards"),
        "timeline": PROJECT_STATE.get("timeline"),
        "metrics": {
            "health": PROJECT_STATE.get("health"), "cpi": PROJECT_STATE.get("cpi"),
            "spi": PROJECT_STATE.get("spi"), "safetyScore": PROJECT_STATE.get("safetyScore"),
            "budgetUsed": PROJECT_STATE.get("budgetUsed"),
        },
    }

    try:
        report = ai_json([
            {"role": "system", "content":
             "You are a construction project engineer. Produce ONE Daily Progress Report (DPR) as strict JSON "
             "matching this schema exactly (no extra keys): "
             "{\"date\": ISO-date, \"summary\": markdown 2-4 sentences, \"progress\": e.g. '45%', "
             "\"workDone\": [string], \"workPlanned\": [string], \"issues\": [string], "
             "\"weatherImpact\": string, \"safetyNotes\": string, \"aiRecommendations\": [string]}."},
            {"role": "user", "content": json.dumps(context, default=str)},
        ])
    except AgentUnavailable as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(502, f"Daily report failed: {e}")

    report.setdefault("date", date.today().isoformat())
    PROJECT_STATE.setdefault("dailyReports", []).insert(0, report)
    PROJECT_STATE["dailyReports"] = PROJECT_STATE["dailyReports"][:30]
    return {"status": "success", "report": report, "project_state": PROJECT_STATE}


@app.post("/api/analyze-risks")
def analyze_risks():
    if not PROJECT_STATE.get("project"):
        raise HTTPException(400, "No active project.")

    try:
        result = ai_json([
            {"role": "system", "content":
             "Re-evaluate the construction risk register using current weather, materials, and timeline. "
             "Return JSON: {\"risks\":[{\"id\":str,\"desc\":str,\"prob\":\"Low|Medium|High\","
             "\"impact\":\"Low|Medium|High\",\"status\":\"Open|Mitigating|Closed\","
             "\"category\":str,\"mitigation\":str,\"score\":int 1-9}]}. "
             "score = prob*impact numerically (Low=1, Medium=2, High=3). Provide 4-8 risks."},
            {"role": "user", "content": json.dumps({
                "project": PROJECT_STATE.get("project"),
                "current_risks": PROJECT_STATE.get("risks", []),
                "weather": PROJECT_STATE.get("weatherReport"),
                "materials": PROJECT_STATE.get("materials"),
                "timeline": PROJECT_STATE.get("timeline"),
            }, default=str)},
        ])
    except AgentUnavailable as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(502, f"Risk analysis failed: {e}")

    if isinstance(result.get("risks"), list):
        PROJECT_STATE["risks"] = result["risks"]
    return {"status": "success", "project_state": PROJECT_STATE}


@app.post("/api/analyze-safety")
def analyze_safety():
    if not PROJECT_STATE.get("project"):
        raise HTTPException(400, "No active project.")

    try:
        result = ai_json([
            {"role": "system", "content":
             "Predict site-specific safety hazards for TODAY based on active construction phase, weather, "
             "past incidents, and the project document. Return JSON: "
             "{\"safetyHazards\":[{\"id\":str,\"hazard\":str,\"location\":str,"
             "\"likelihood\":\"Low|Medium|High\",\"severity\":\"Low|Medium|High\",\"control\":str}]} "
             "with 4-8 items. Controls MUST be actionable (specific PPE, exclusion zones, permits)."},
            {"role": "user", "content": json.dumps({
                "project": PROJECT_STATE.get("project"),
                "weather": PROJECT_STATE.get("weatherReport"),
                "safety_logs": PROJECT_STATE.get("safety", []),
                "current_hazards": PROJECT_STATE.get("safetyHazards", []),
                "timeline": PROJECT_STATE.get("timeline"),
            }, default=str)},
        ])
    except AgentUnavailable as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(502, f"Safety analysis failed: {e}")

    if isinstance(result.get("safetyHazards"), list):
        PROJECT_STATE["safetyHazards"] = result["safetyHazards"]
    return {"status": "success", "project_state": PROJECT_STATE}


@app.post("/api/optimize-timeline")
def optimize_timeline():
    if not PROJECT_STATE.get("project"):
        raise HTTPException(400, "No active project.")

    try:
        result = ai_json([
            {"role": "system", "content":
             "Re-optimize the construction schedule using weather forecast, material shortages, and open risks. "
             "Return JSON: {\"timeline\":[{\"name\":str,\"start\":int week,\"length\":int weeks,"
             "\"status\":\"planned|active|done|delayed\",\"progress\":int 0-100,"
             "\"risk\":\"Low|Medium|High\",\"note\":str explaining any change}]}. "
             "Provide 5-8 phases. Keep phase names stable when possible; only change durations/risk with a reason."},
            {"role": "user", "content": json.dumps({
                "project": PROJECT_STATE.get("project"),
                "current_timeline": PROJECT_STATE.get("timeline", []),
                "weather": PROJECT_STATE.get("weatherReport"),
                "materials": PROJECT_STATE.get("materials"),
                "risks": PROJECT_STATE.get("risks"),
            }, default=str)},
        ])
    except AgentUnavailable as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(502, f"Timeline optimization failed: {e}")

    if isinstance(result.get("timeline"), list):
        PROJECT_STATE["timeline"] = result["timeline"]
    return {"status": "success", "project_state": PROJECT_STATE}


if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
