# Construction Intelligence Hub

An AI-Powered construction intelligence platform that connects project setup, scheduling, material procurement, heavy machinery operations, safety, risk management, and document analysis (RAG) into a single, unified command center.

## Features

- **Dynamic Setup Wizard**: Initialize project baselines and parameters.
- **Unified AI Copilot**: Chat-based AI assistant utilizing a LangGraph agent workflow.
- **RAG Document Search**: Ingest specifications, drawing logs, and reports using local Qdrant vector database hybrid search and optional Cohere Reranking.
- **Cross-Module Sync**: Simulation tool to showcase how events (e.g. storms or material shortages) propagate across different modules.
- **Visual Analytics**: Interactive dashboards with charts tracking SPI, CPI, safety scores, and workforce metrics.

---

## Tech Stack

- **Backend**: FastAPI, LangChain, LangGraph, Qdrant (local persistent DB), FastEmbed (local embedding generator), Cohere Reranking (optional)
- **Frontend**: HTML5, Tailwind CSS, Javascript, Lucide Icons, GSAP, Chart.js

---

## Getting Started

### 1. Prerequisites
- Python 3.10+
- Pip (Python Package Manager)

### 2. Configure Environment Variables
Create a `.env` file in the root directory (copy from the template) and supply your API keys:
```env
MISTRAL_API_KEY=your_mistral_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here
OPENWEATHER_API_KEY=your_openweather_api_key_here
COHERE_API_KEY=your_cohere_api_key_here (optional)
```

### 3. Installation
Install the required packages:
```bash
pip install -r requirements.txt
```

### 4. Run the Backend Server
Start the Uvicorn ASGI server:
```bash
python app.py
```
The backend server will run on `http://127.0.0.1:8000`.

### 5. Launch the Frontend
Open `index.html` directly in a browser (or serve it locally using a server extension/tool).
