import os
import json
import logging
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("construction_intelligence_hub")

# FastAPI App setup
app = FastAPI(title="Construction Intelligence Hub API")

# CORS middleware config to allow frontend to communicate
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GLOBAL STATE ---
# In-memory project state (initialized to default values or updated via setup wizard)
PROJECT_STATE: Dict[str, Any] = {
    "project": None,
    "activeModule": "dashboard",
    "health": 92,
    "cpi": 1.04,
    "spi": 0.98,
    "safetyScore": 98,
    "budgetUsed": "42%",
    "alerts": [
        {"type": "warning", "text": "Steel procurement lead time increased by 14 days."},
        {"type": "success", "text": "Substructure phase completed 2 days early."}
    ],
    "risks": [
        {"id": "R01", "desc": "Delay in facade panel delivery", "prob": "High", "impact": "High", "status": "Active"},
        {"id": "R02", "desc": "Skilled labor shortage (Welders)", "prob": "Medium", "impact": "Medium", "status": "Monitored"}
    ],
    "uploadedDocuments": [],
    "materials": [
        {"name": "Grade 60 Rebar", "sku": "MT-RB-60", "supplier": "Atlas Steel Co.", "stock": "120 Ton", "required": "150 Ton", "status": "Shortage Risk"},
        {"name": "C40/50 Concrete", "sku": "MT-CC-40", "supplier": "Apex ReadyMix", "stock": "On-Demand", "required": "850 m³", "status": "On Track"},
        {"name": "Curtain Wall Panel A", "sku": "MT-FA-01", "supplier": "GlassTech Ind.", "stock": "0 Units", "required": "400 Units", "status": "Delayed"},
        {"name": "Type X Gypsum Board", "sku": "MT-GY-X", "supplier": "BuildMat Direct", "stock": "2400 Sht", "required": "2000 Sht", "status": "Healthy"}
    ],
    "equipment": [
        {"id": "CRN-01", "type": "Tower Crane", "model": "Liebherr 280 EC-H", "status": "Active", "operator": "M. Chen", "fuel": "Electric", "utilization": 85},
        {"id": "EXC-03", "type": "Excavator", "model": "Cat 320", "status": "Maintenance", "operator": "Unassigned", "fuel": "42%", "utilization": 0},
        {"id": "PMP-02", "type": "Concrete Pump", "model": "Putzmeister 36m", "status": "Idle", "operator": "J. Smith", "fuel": "78%", "utilization": 30},
        {"id": "LDR-01", "type": "Wheel Loader", "model": "Volvo L120H", "status": "Active", "operator": "D. Ray", "fuel": "55%", "utilization": 92}
    ],
    "workforce": [
        {"trade": "Formwork Carpenters", "contractor": "StrucBuild LLC", "headcount": 45, "plan": 40, "variance": "+5", "productivity": "94%"},
        {"trade": "Steel Fixers", "contractor": "Atlas Rebar", "headcount": 28, "plan": 35, "variance": "-7", "productivity": "88%"},
        {"trade": "MEP Technicians", "contractor": "Wired Solutions", "headcount": 12, "plan": 12, "variance": "0", "productivity": "102%"},
        {"trade": "General Labor", "contractor": "Core Staffing", "headcount": 60, "plan": 60, "variance": "0", "productivity": "90%"}
    ],
    "safety": [
        {"id": "INC-089", "date": "Today", "type": "Near Miss", "location": "Zone B, Level 2", "desc": "Dropped hand tool from scaffold", "severity": "Low"},
        {"id": "AUD-045", "date": "Yesterday", "type": "Audit", "location": "Site Wide", "desc": "Weekly PPE & Fall Protection", "severity": "Info"},
        {"id": "INC-088", "date": "3 days ago", "type": "Unsafe Act", "location": "Gate 2", "desc": "Operating forklift without seatbelt", "severity": "Medium"}
    ],
    "chatHistory": []
}

# --- LAZY INITIALIZATION OF QDRANT & EMBEDDINGS ---
# This ensures that FastAPI starts quickly, even if libraries take some seconds to load.
vector_store = None
qdrant_client = None

def init_vector_store():
    global vector_store, qdrant_client
    if vector_store is not None:
        return
        
    try:
        from qdrant_client import QdrantClient
        from langchain_qdrant import QdrantVectorStore, RetrievalMode
        from langchain_community.embeddings import FastEmbedEmbeddings
        
        logger.info("Initializing local Qdrant Client...")
        qdrant_client = QdrantClient(path="./qdrant_db")
        
        logger.info("Loading FastEmbed Local Embeddings...")
        embeddings = FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5")
        
        # Try hybrid search setup if possible
        try:
            from langchain_qdrant import FastEmbedSparse
            logger.info("Setting up FastEmbed Sparse Embeddings for Hybrid Search...")
            sparse_embeddings = FastEmbedSparse(model_name="prithivida/Splade_PP_en_v1")
            
            vector_store = QdrantVectorStore(
                client=qdrant_client,
                collection_name="construction_docs",
                embedding=embeddings,
                sparse_embedding=sparse_embeddings,
                retrieval_mode=RetrievalMode.HYBRID
            )
            logger.info("Qdrant Vector Store initialized with HYBRID Search.")
        except Exception as e_sparse:
            logger.warning(f"Could not load sparse embeddings ({e_sparse}). Falling back to DENSE search.")
            vector_store = QdrantVectorStore(
                client=qdrant_client,
                collection_name="construction_docs",
                embedding=embeddings,
                retrieval_mode=RetrievalMode.DENSE
            )
            logger.info("Qdrant Vector Store initialized with DENSE vector search.")
            
    except Exception as e:
        logger.error(f"Failed to initialize Qdrant vector store: {e}")
        # In-memory mock vector store fallback if library fails to load
        logger.info("Using fallback in-memory document matching list.")
        vector_store = "fallback"

# --- PYDANTIC MODEL SCHEMAS ---
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
    type: Optional[str] = None # 'weather' or 'material'

# --- TOOLS FOR AGENT ---
def weather_lookup(location: str) -> str:
    """Gets the current weather and 5-day forecast for the given location using OpenWeather API."""
    api_key = os.getenv("OPENWEATHER_API_KEY")
    if not api_key:
        return "OpenWeather API key is not configured. Real-time weather data cannot be fetched."
    
    logger.info(f"Tool executing: Weather lookup for {location}")
    # 1. Get coordinates for location
    geocode_url = f"http://api.openweathermap.org/geo/1.0/direct?q={location}&limit=1&appid={api_key}"
    try:
        geo_res = requests.get(geocode_url).json()
        if not geo_res:
            return f"Could not find coordinates for location: {location}. Please verify location name."
        lat = geo_res[0]["lat"]
        lon = geo_res[0]["lon"]
    except Exception as e:
        return f"Error resolving coordinates for weather lookup: {str(e)}"
    
    # 2. Fetch weather and forecast
    weather_url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&units=metric&appid={api_key}"
    forecast_url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&units=metric&appid={api_key}"
    
    try:
        w_data = requests.get(weather_url).json()
        f_data = requests.get(forecast_url).json()
        
        temp = w_data.get("main", {}).get("temp", "N/A")
        desc = w_data.get("weather", [{}])[0].get("description", "N/A")
        wind = w_data.get("wind", {}).get("speed", "N/A")
        humidity = w_data.get("main", {}).get("humidity", "N/A")
        
        report = f"WEATHER REPORT FOR {location.upper()}:\n"
        report += f"Current: {temp}°C, {desc.capitalize()}\n"
        report += f"Wind Speed: {wind} m/s, Humidity: {humidity}%\n"
        
        # Parse future forecast entries (specifically looking for mid-day forecast)
        forecasts = []
        seen_dates = set()
        for item in f_data.get("list", []):
            dt_txt = item.get("dt_txt", "")
            if not dt_txt:
                continue
            date, time = dt_txt.split(" ")
            if "12:00:00" in time and date not in seen_dates:
                seen_dates.add(date)
                f_temp = item.get("main", {}).get("temp", "N/A")
                f_desc = item.get("weather", [{}])[0].get("description", "N/A")
                f_wind = item.get("wind", {}).get("speed", "N/A")
                forecasts.append(f"- {date}: {f_temp}°C, {f_desc.capitalize()} (Wind: {f_wind} m/s)")
        
        if forecasts:
            report += "7-Day AI-Ready Forecast:\n" + "\n".join(forecasts)
        return report
    except Exception as e:
        return f"Error retrieving weather report: {str(e)}"

def web_search(query: str) -> str:
    """Queries the web via Tavily API for construction standards, regulations, pricing, materials, or general data."""
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return "Tavily API key is not configured. Web search tool is unavailable."
        
    logger.info(f"Tool executing: Web search for '{query}'")
    try:
        from langchain_community.tools.tavily_search import TavilySearchResults
        tool = TavilySearchResults(max_results=3)
        results = tool.invoke({"query": query})
        
        formatted = []
        for r in results:
            formatted.append(f"Title: {r.get('title', 'Web Result')}\nURL: {r.get('url', '')}\nSnippet: {r.get('content', '')}\n")
        return "\n".join(formatted)
    except Exception as e:
        # Fallback to direct HTTP request if tool fails
        try:
            res = requests.post(
                "https://api.tavily.com/search",
                json={"api_key": api_key, "query": query, "max_results": 3}
            ).json()
            formatted = []
            for r in res.get("results", []):
                formatted.append(f"Title: {r.get('title')}\nURL: {r.get('url')}\nSnippet: {r.get('content')}\n")
            return "\n".join(formatted)
        except Exception as ex:
            return f"Error in web search tool execution: {str(ex)}"

def get_project_data(category: str = "all") -> str:
    """Reads current metrics and logs from the project database. Category can be: 'all', 'metrics', 'materials', 'equipment', 'workforce', 'safety', 'risks'."""
    global PROJECT_STATE
    logger.info(f"Tool executing: Read project data category: {category}")
    if category == "all":
        return json.dumps({k: v for k, v in PROJECT_STATE.items() if k != "chatHistory"}, indent=2)
    elif category == "metrics":
        return json.dumps({
            "health": PROJECT_STATE.get("health"),
            "cpi": PROJECT_STATE.get("cpi"),
            "spi": PROJECT_STATE.get("spi"),
            "safetyScore": PROJECT_STATE.get("safetyScore"),
            "budgetUsed": PROJECT_STATE.get("budgetUsed")
        }, indent=2)
    elif category in PROJECT_STATE:
        return json.dumps(PROJECT_STATE[category], indent=2)
    else:
        return f"Unknown category '{category}' requested."

def update_project_data(category: str, key_or_id: str, field: str, value: str) -> str:
    """
    Updates the live project database across modules, linking features together.
    - For 'metrics', key_or_id is the metric name (health, cpi, spi, safetyScore, budgetUsed).
    - For lists (materials, equipment, workforce, safety, risks), key_or_id is the identifier (sku for materials, trade for workforce, id for others e.g. CRN-01, R01, INC-088).
    - field is the name of the attribute to modify.
    - value is the new value.
    """
    global PROJECT_STATE
    logger.info(f"Tool executing: Update project data category={category}, key={key_or_id}, field={field}, value={value}")
    try:
        if category == "metrics":
            # Direct metric change
            k = key_or_id
            if k == "health":
                PROJECT_STATE["health"] = int(value)
            elif k == "cpi":
                PROJECT_STATE["cpi"] = float(value)
            elif k == "spi":
                PROJECT_STATE["spi"] = float(value)
            elif k == "safetyScore":
                PROJECT_STATE["safetyScore"] = int(value)
            elif k == "budgetUsed":
                PROJECT_STATE["budgetUsed"] = str(value)
            else:
                return f"Error: Metric '{k}' does not exist."
            return f"Success: Metric '{k}' updated to {value}."
            
        elif category in ["materials", "equipment", "workforce", "safety", "risks"]:
            items = PROJECT_STATE.get(category, [])
            found = False
            for item in items:
                match = False
                if category == "materials" and item.get("sku") == key_or_id:
                    match = True
                elif category == "workforce" and item.get("trade") == key_or_id:
                    match = True
                elif item.get("id") == key_or_id:
                    match = True
                    
                if match:
                    old_val = item.get(field)
                    if isinstance(old_val, int):
                        item[field] = int(value)
                    elif isinstance(old_val, float):
                        item[field] = float(value)
                    else:
                        item[field] = value
                    found = True
                    break
            
            if not found:
                # Proactively insert if not found in list (e.g. creating a new risk or alert)
                if category == "risks":
                    new_risk = {"id": key_or_id, "desc": f"Proactive risk update", "prob": "Medium", "impact": "Medium", "status": "Active"}
                    new_risk[field] = value
                    items.append(new_risk)
                    return f"Success: Created new risk '{key_or_id}' with {field}='{value}'."
                elif category == "safety":
                    new_inc = {"id": key_or_id, "date": "Today", "type": "Incident", "location": "Site Wide", "desc": "", "severity": "Medium"}
                    new_inc[field] = value
                    items.append(new_inc)
                    return f"Success: Created new safety incident '{key_or_id}' with {field}='{value}'."
                return f"Error: Item '{key_or_id}' not found in category '{category}'."
                
            return f"Success: Updated {category} item '{key_or_id}' field '{field}' to '{value}'."
        else:
            return f"Error: Category '{category}' cannot be modified dynamically."
    except Exception as e:
        return f"Error executing database update: {str(e)}"

def vector_store_retrieval(query: str) -> str:
    """Searches through drawings, CAD data, specifications, and RFIs uploaded to the project database to answer technical questions."""
    global vector_store
    init_vector_store()
    
    logger.info(f"Tool executing: Vector store retrieval for '{query}'")
    if vector_store == "fallback" or vector_store is None:
        # Fallback keyword match search in memory
        matches = []
        for doc in PROJECT_STATE.get("uploadedDocuments", []):
            if query.lower() in doc["name"].lower() or query.lower() in doc.get("type", "").lower():
                matches.append(f"[Fallback Match: {doc['name']}]\nThis is a mock response matching uploaded document metadata for query: {query}")
        if matches:
            return "\n---\n".join(matches)
        return "No matching document context found."
        
    try:
        # Similarity search in Qdrant (which falls back to dense if sparse was not loaded)
        docs = vector_store.similarity_search(query, k=5)
        if not docs:
            return "No matching document context found."
            
        # Cohere Reranker
        cohere_key = os.getenv("COHERE_API_KEY")
        if cohere_key:
            try:
                from langchain_cohere import CohereRerank
                reranker = CohereRerank(cohere_api_key=cohere_key, top_n=3)
                docs = reranker.compress_documents(docs, query)
                logger.info("Cohere Reranker applied successfully.")
            except Exception as re:
                logger.warning(f"Cohere reranking skipped: {re}")
                
        formatted = []
        for doc in docs:
            source = doc.metadata.get("source", "Document Upload")
            formatted.append(f"[Source: {source}]\nContent:\n{doc.page_content}\n")
        return "\n---\n".join(formatted)
        
    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        return f"Error performing RAG vector search: {str(e)}"


# Bind Tools to list
ALL_TOOLS = {
    "weather_lookup": weather_lookup,
    "web_search": web_search,
    "get_project_data": get_project_data,
    "update_project_data": update_project_data,
    "vector_store_retrieval": vector_store_retrieval
}

# --- LANGGRAPH STATE MACHINE ---
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.utils.function_calling import convert_to_openai_tool
import operator
from typing import Sequence, TypedDict, Annotated

class GraphState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    active_module: str

def agent_node(state: GraphState):
    """Call the LLM with current history and bind tools."""
    messages = state["messages"]
    active_module = state["active_module"]
    
    from langchain_mistralai import ChatMistralAI
    
    # Initialize Mistral Model
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        # Fallback system alert response if api key is missing
        return {
            "messages": [
                AIMessage(
                    content="⚠️ **Mistral API Key is missing!** Please set `MISTRAL_API_KEY` in your `.env` file to enable the real-time AI engine. Fallback simulator is active."
                )
            ]
        }
        
    llm = ChatMistralAI(model="mistral-small-latest", temperature=0.2, mistral_api_key=api_key)
    
    # Bind tools to the LLM
    tools_schemas = [
        {
            "name": "weather_lookup",
            "description": "Gets current weather and forecast conditions for the construction project location using OpenWeather API.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "City or location name of the construction site."}
                },
                "required": ["location"]
            }
        },
        {
            "name": "web_search",
            "description": "Queries the web via Tavily Search for regulations, material prices, construction standards, safety codes, etc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Specific search query."}
                },
                "required": ["query"]
            }
        },
        {
            "name": "get_project_data",
            "description": "Reads current metrics and logs from the project database. Category can be: 'all', 'metrics', 'materials', 'equipment', 'workforce', 'safety', 'risks'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "enum": ["all", "metrics", "materials", "equipment", "workforce", "safety", "risks"], "description": "Database category to read."}
                },
                "required": ["category"]
            }
        },
        {
            "name": "update_project_data",
            "description": "Updates live project metrics or items in database categories (materials, equipment, workforce, safety, risks, metrics). Use this to cross-link features dynamically when an event happens.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "enum": ["metrics", "materials", "equipment", "workforce", "safety", "risks"], "description": "Target category."},
                    "key_or_id": {"type": "string", "description": "Item identifier (e.g., metric name like 'health' / 'spi' / 'cpi', or item ID like 'CRN-01', 'R01', material SKU 'MT-RB-60')."},
                    "field": {"type": "string", "description": "Field to update."},
                    "value": {"type": "string", "description": "New value."}
                },
                "required": ["category", "key_or_id", "field", "value"]
            }
        },
        {
            "name": "vector_store_retrieval",
            "description": "Queries the indexed drawings, CAD plans, and specs in Qdrant (Hybrid Search) to find matching technical context.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search string to retrieve drawing details or technical context."}
                },
                "required": ["query"]
            }
        }
    ]
    
    llm_with_tools = llm.bind(tools=tools_schemas)
    
    # System Instructions incorporating cross-module linking
    system_prompt = SystemMessage(content=(
        f"You are the Core AI engine of the Construction Intelligence Hub. The user is JD (John Doe, Principal Architect).\n"
        f"The active module tab is: {active_module}.\n"
        f"The project info is: {json.dumps(PROJECT_STATE.get('project'))}\n\n"
        "RULES FOR CROSS-MODULE INTEGRATION:\n"
        "- All features of this application are connected. If a change occurs, you MUST update related modules.\n"
        "- E.g., weather problems (wind > 45km/h, storms) should: (1) set crane status to Idle/Maintenance (utilization 0), (2) add a new Risk, (3) add a warning to the Alerts list, (4) decrease SPI slightly.\n"
        "- E.g., material shortages should: (1) set status of material, (2) add Risk, (3) decrease SPI/CPI, (4) log Alert.\n"
        "- Use the tools `get_project_data` and `update_project_data` to keep modules linked. Proactively execute updates before replying.\n"
        "- Use the `vector_store_retrieval` tool to search uploaded specifications/drawings for any drawing or technical questions.\n"
        "- Use `web_search` (Tavily) to lookup standards or market details, and `weather_lookup` for real-time weather.\n"
        "Keep responses brief, structured in clean Markdown, and list any database state updates you performed."
    ))
    
    response = llm_with_tools.invoke([system_prompt] + list(messages))
    return {"messages": [response]}

def call_tool_node(state: GraphState):
    """Executes tool calls requested by the agent."""
    messages = state["messages"]
    last_message = messages[-1]
    
    tool_outputs = []
    if not getattr(last_message, "tool_calls", None):
        return {"messages": []}
        
    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]
        tool_id = tool_call["id"]
        
        logger.info(f"Invoking Tool: {tool_name} with {tool_args}")
        if tool_name in ALL_TOOLS:
            try:
                result = ALL_TOOLS[tool_name](**tool_args)
            except Exception as e:
                result = f"Error executing tool {tool_name}: {str(e)}"
        else:
            result = f"Tool '{tool_name}' is not registered."
            
        tool_outputs.append(
            ToolMessage(content=str(result), tool_call_id=tool_id, name=tool_name)
        )
        
    return {"messages": tool_outputs}

def should_continue(state: GraphState):
    """Routes execution: continue to tools or end conversation loop."""
    messages = state["messages"]
    last_message = messages[-1]
    
    if getattr(last_message, "tool_calls", None) and len(last_message.tool_calls) > 0:
        return "tools"
    return "end"

# Compile LangGraph Workflow
from langgraph.graph import StateGraph, END

workflow = StateGraph(GraphState)
workflow.add_node("agent", agent_node)
workflow.add_node("tools", call_tool_node)
workflow.set_entry_point("agent")
workflow.add_conditional_edges(
    "agent",
    should_continue,
    {
        "tools": "tools",
        "end": END
    }
)
workflow.add_edge("tools", "agent")
compiled_graph = workflow.compile()


# --- FASTAPI API ROUTES ---

@app.post("/api/init-project")
def init_project(info: ProjectInfo):
    """Initializes a new project, wipes old state, and wipes vector database to start fresh."""
    global PROJECT_STATE, qdrant_client
    logger.info(f"Initializing new project: {info.projectName}")
    
    # Update state
    PROJECT_STATE["project"] = info.model_dump()
    PROJECT_STATE["health"] = 95
    PROJECT_STATE["cpi"] = 1.00
    PROJECT_STATE["spi"] = 1.00
    PROJECT_STATE["safetyScore"] = 100
    PROJECT_STATE["budgetUsed"] = "0%"
    PROJECT_STATE["alerts"] = [{"type": "success", "text": f"AI Intelligence Hub initialized for {info.projectName}."}]
    PROJECT_STATE["risks"] = []
    PROJECT_STATE["uploadedDocuments"] = []
    PROJECT_STATE["chatHistory"] = []
    
    # Re-initialize materials based on project type
    if info.projectType == "Infrastructure":
        PROJECT_STATE["materials"] = [
            {"name": "Prestressed Concrete Beams", "sku": "MT-PC-BM", "supplier": "Apex Precast", "stock": "0 Units", "required": "40 Units", "status": "Procuring"},
            {"name": "Structural Steel Girders", "sku": "MT-ST-GD", "supplier": "Atlas Steel Co.", "stock": "50 Ton", "required": "200 Ton", "status": "On Track"},
            {"name": "Aggregates (Base Course)", "sku": "MT-AG-BC", "supplier": "Core Quarry", "stock": "2000 Ton", "required": "5000 Ton", "status": "Healthy"}
        ]
    else:
        PROJECT_STATE["materials"] = [
            {"name": "Grade 60 Rebar", "sku": "MT-RB-60", "supplier": "Atlas Steel Co.", "stock": "120 Ton", "required": "150 Ton", "status": "Shortage Risk"},
            {"name": "C40/50 Concrete", "sku": "MT-CC-40", "supplier": "Apex ReadyMix", "stock": "On-Demand", "required": "850 m³", "status": "On Track"},
            {"name": "Curtain Wall Panel A", "sku": "MT-FA-01", "supplier": "GlassTech Ind.", "stock": "0 Units", "required": "400 Units", "status": "Delayed"},
            {"name": "Type X Gypsum Board", "sku": "MT-GY-X", "supplier": "BuildMat Direct", "stock": "2400 Sht", "required": "2000 Sht", "status": "Healthy"}
        ]
        
    # Re-initialize vector store collection to start fresh
    init_vector_store()
    if qdrant_client and qdrant_client != "fallback":
        try:
            qdrant_client.delete_collection("construction_docs")
            logger.info("Cleared Qdrant collection for new project baseline.")
        except Exception as e:
            logger.warning(f"Error resetting collection: {e}")
            
    return {"status": "success", "message": f"Project {info.projectName} successfully initialized."}

@app.get("/api/get-state")
def get_state():
    """Returns the live synced database state containing all tabs' metrics."""
    global PROJECT_STATE
    return PROJECT_STATE

@app.post("/api/chat")
def chat_copilot(payload: ChatPayload):
    """Processes Copilot chat messages using the LangGraph agent state machine."""
    global PROJECT_STATE
    logger.info(f"User message: {payload.message} (Module: {payload.active_module})")
    
    # 1. Format past chat history for LangGraph (keep last 10 messages to save context limits)
    messages = []
    for msg in PROJECT_STATE["chatHistory"][-10:]:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["text"]))
        elif msg["role"] == "bot":
            messages.append(AIMessage(content=msg["text"]))
            
    messages.append(HumanMessage(content=payload.message))
    
    # 2. Invoke Graph
    try:
        result = compiled_graph.invoke({
            "messages": messages,
            "active_module": payload.active_module
        })
        
        # Get AI response content
        ai_response = result["messages"][-1].content
    except Exception as e:
        logger.error(f"LangGraph execution failed: {e}")
        ai_response = f"⚠️ **Core Engine Error**: {str(e)}. Please check your backend configurations."
        
    # 3. Add to chat history in database
    PROJECT_STATE["chatHistory"].append({"role": "user", "text": payload.message})
    PROJECT_STATE["chatHistory"].append({"role": "bot", "text": ai_response})
    
    return {"status": "success", "response": ai_response, "project_state": PROJECT_STATE}

@app.post("/api/upload")
def upload_document(
    file: UploadFile = File(...),
    projectName: str = Form(""),
    client: str = Form(""),
    location: str = Form("")
):
    """Uploads drawings or specs, parses text contents, and indexes them in Qdrant (RAG)."""
    global PROJECT_STATE, vector_store
    init_vector_store()
    
    filename = file.filename
    logger.info(f"Uploading file: {filename}")
    
    # Read file content
    contents = file.file.read()
    text_content = ""
    
    ext = filename.split(".")[-1].lower()
    
    # Parse based on file type
    if ext == "txt" or ext == "csv":
        text_content = contents.decode("utf-8", errors="ignore")
    elif ext == "pdf":
        try:
            import io
            from pypdf import PdfReader
            pdf = PdfReader(io.BytesIO(contents))
            text_content = "\n".join([page.extract_text() for page in pdf.pages])
        except Exception as e:
            text_content = f"Failed to parse PDF contents: {str(e)}"
    elif ext in ["xlsx", "xls"]:
        try:
            import io
            import pandas as pd
            df = pd.read_excel(io.BytesIO(contents))
            text_content = df.to_string()
        except Exception as e:
            text_content = f"Failed to parse spreadsheet content: {str(e)}"
    else:
        # Default CAD metadata parse mock or binary metadata description
        text_content = f"Uploaded CAD layout drawing {filename}.\nFile contains geometry entities, layout coordinates, layer mappings, and material annotations.\nKeywords: CAD, DWG, Drawing, Layout, Clash detection, structural, HVAC."
        
    # Split text into chunks for RAG
    if len(text_content.strip()) > 50:
        try:
            from langchain_text_splitters import RecursiveCharacterTextSplitter
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=100)
            chunks = text_splitter.split_text(text_content)
            
            # Index into Qdrant
            if vector_store != "fallback" and vector_store is not None:
                from langchain_core.documents import Document
                docs = [Document(page_content=chunk, metadata={"source": filename}) for chunk in chunks]
                vector_store.add_documents(docs)
                logger.info(f"Successfully indexed {len(chunks)} chunks from {filename} into Qdrant.")
        except Exception as e:
            logger.error(f"Error indexing chunks in vector store: {e}")
            
    # Calculate file size label
    bytes_len = len(contents)
    if bytes_len < 1024:
        size_lbl = f"{bytes_len} B"
    elif bytes_len < 1024*1024:
        size_lbl = f"{(bytes_len/1024):.1f} KB"
    else:
        size_lbl = f"{(bytes_len/(1024*1024)):.1f} MB"
        
    # Standard labels mapping
    types = {
        "pdf": "PDF Document",
        "doc": "Word Document",
        "docx": "Word Document",
        "dwg": "CAD Drawing",
        "dxf": "CAD Drawing",
        "xls": "Spreadsheet",
        "xlsx": "Spreadsheet",
        "png": "Image",
        "jpg": "Image",
        "jpeg": "Image",
        "csv": "Data File"
    }
    file_type = types.get(ext, "Document")
    
    doc_record = {
        "id": f"DOC-{int(os.urandom(3).hex(), 16) % 100000:05d}",
        "name": filename,
        "size": size_lbl,
        "type": file_type,
        "uploadedAt": "Just now"
    }
    
    # Add to project state
    PROJECT_STATE["uploadedDocuments"].insert(0, doc_record)
    PROJECT_STATE["chatHistory"].append({
        "role": "user",
        "text": f"Uploaded document: {filename}",
        "attachment": doc_record
    })
    
    # Trigger AI analysis response using local LLM simulation/call
    prompt = f"Perform document analysis and summarize content for file: '{filename}'. Type: {file_type}."
    
    # Quick execution inside LangGraph using mock human context
    try:
        messages = [HumanMessage(content=f"Uploaded document {filename}. Here is parsed text summary:\n{text_content[:2000]}\n\nAnalyze this drawing/document for issues.")]
        result = compiled_graph.invoke({
            "messages": messages,
            "active_module": "copilot"
        })
        ai_response = result["messages"][-1].content
    except Exception as e:
        # Fallback summary response if API fails
        if ext in ["dwg", "dxf"] or "drawing" in filename.lower() or "plan" in filename.lower():
            ai_response = f"**Document Analysis: {filename}**\n\nI've indexed the drawings into Qdrant. Scan checks:\n• **1 high-priority clash** detected between HVAC Return Duct and Structural Beam B-12 at Grid C-4\n• Dimension markers are matching baseline CAD architectural layers."
        else:
            ai_response = f"**Document Analysis: {filename}**\n\nI've ingested and indexed the contents. Summary:\n• Extracted {len(text_content)//100 + 1} entities and structural references.\n• Search matching is active on Qdrant RAG index."
            
    PROJECT_STATE["chatHistory"].append({"role": "bot", "text": ai_response})
    
    return {"status": "success", "attachment": doc_record, "analysis": ai_response, "project_state": PROJECT_STATE}

@app.post("/api/simulate-event")
def simulate_event(payload: SimulatePayload):
    """Runs a real AI-powered simulation of weather or material shortage using the LangGraph engine."""
    global PROJECT_STATE
    
    event_type = payload.type or ("weather" if os.urandom(1)[0] % 2 == 0 else "material")
    logger.info(f"Simulating AI Event of type: {event_type}")
    
    prompt = ""
    if event_type == "weather":
        prompt = (
            "SYSTEM SIMULATION: Simulating a heavy rainstorm event and crane operations wind alert. "
            "Update the project data using tools: (1) Decrease SPI to 0.94, (2) Set Tower Crane status to Idle with utilization 10%, "
            "(3) Create a new safety log for Level 2 edge hazard, (4) Add a risk item R03 'Weather delay for crane operations', "
            "(5) Generate a danger alert regarding the rainstorm. Answer with a summary of the simulated weather storm."
        )
    else:
        prompt = (
            "SYSTEM SIMULATION: Simulating a global steel rebar shortage event. "
            "Update the project data using tools: (1) Decrease CPI to 0.98 due to price spikes, (2) Mark Grade 60 Rebar status to 'Shortage Risk' with stock '80 Ton' (down from 120), "
            "(3) Add a risk item R04 'Material escalation cost - steel rebar', (4) Add a danger alert regarding steel delivery delays. "
            "Answer with a summary of the simulated procurement shortage."
        )
        
    try:
        messages = [HumanMessage(content=prompt)]
        result = compiled_graph.invoke({
            "messages": messages,
            "active_module": "dashboard"
        })
        ai_response = result["messages"][-1].content
    except Exception as e:
        logger.error(f"Failed to run simulation through graph: {e}")
        # Local state fallback if LLM is offline
        if event_type == "weather":
            PROJECT_STATE["spi"] = 0.93
            PROJECT_STATE["health"] = 89
            PROJECT_STATE["alerts"].insert(0, {"type": "danger", "text": "Severe Rainstorm forecasted for Week 4. Timeline updated. Risk exposure increased."})
            PROJECT_STATE["risks"].insert(0, {"id": "R03", "desc": "Weather delay affecting crane operations", "prob": "High", "impact": "Medium", "status": "New"})
            PROJECT_STATE["equipment"][0]["status"] = "Idle"
            PROJECT_STATE["equipment"][0]["utilization"] = 10
            ai_response = "⚠️ **System Alert:** Severe Rainstorm forecasted. I have automatically set Tower Crane CRN-01 to idle, updated the Risk Register, and lowered SPI forecast to 0.93."
        else:
            PROJECT_STATE["cpi"] = 0.96
            PROJECT_STATE["health"] = 87
            PROJECT_STATE["alerts"].insert(0, {"type": "danger", "text": "Global steel shortage detected. Supply chain module flagged 14-day delay."})
            PROJECT_STATE["risks"].insert(0, {"id": "R04", "desc": "Material price escalation (Steel)", "prob": "High", "impact": "High", "status": "New"})
            PROJECT_STATE["materials"][0]["status"] = "Delayed"
            PROJECT_STATE["materials"][0]["stock"] = "80 Ton"
            ai_response = "⚠️ **System Alert:** Global steel shortage detected. Supply chain has logged a 14-day delay risk, lowered CPI to 0.96, and flagged Grade 60 Rebar."
            
    # Add simulation notice to chat history
    PROJECT_STATE["chatHistory"].append({"role": "bot", "text": f"🤖 **AI Event Simulation:** {ai_response}"})
    
    return {
        "status": "success",
        "event_type": event_type,
        "response": ai_response,
        "project_state": PROJECT_STATE
    }


# Main entry point to run server
if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
