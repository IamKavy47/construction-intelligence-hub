# Construction Intelligence Hub: Feature Guide

This document describes all the active modules, components, and intelligent features available in the Construction Intelligence Hub, highlighting how AI ties them together.

---

## 1. Setup Wizard (Project Intelligence Setup)
- **What it is**: A multi-step onboarding wizard for configuring the baseline details of a construction project.
- **Fields**:
  - **Basic Info**: Project Name, Client, Location, and Project Type (Commercial, Residential, Infrastructure, Industrial).
  - **Building Info**: Floors, Built Area (sqm), and Structural System (e.g. Steel Frame, Precast Concrete).
  - **Schedule Baseline**: Start/Completion Dates and Shift Counts (e.g. 1 Shift, 24/7 operations).
  - **AI Toggles**: Toggle predictive risk intelligence, weather impact matrices, and document conflict scans.
- **AI Backend Action**: Wipes old states and clears the Qdrant database to re-initialize material lists and schedule structures specific to the project type (e.g., Prestressed Concrete Beams for Infrastructure vs. Rebar/Glass for Commercial).

---

## 2. Dashboard
- **What it is**: The project command center providing high-level KPIs and real-time alerts.
- **Metrics Tracked**:
  - **Project Health**: Single percentage score representing overall status.
  - **Schedule Performance Index (SPI)**: Values > 1.0 indicate the project is ahead of schedule.
  - **Cost Performance Index (CPI)**: Values > 1.0 indicate the project is under budget.
  - **Safety Score**: Aggregated hazard/incident rate metric.
  - **Budget Used**: Percentage progress bar.
- **Alerts**: Color-coded notifications (Success, Info, Warning, Danger) that update live based on backend simulations and user interactions.

---

## 3. Timeline Intelligence
- **What it is**: Interactive Gantt-style planning module showing major phases (Planning, Substructure, Superstructure, Facade, MEP, Interior, Handover).
- **AI Connectivity**: Predicts adjustments to critical path timelines when external events (e.g. inclement weather) are introduced.

---

## 4. Material Intelligence
- **What it is**: Inventory and supply chain tracker showing material items, supplier names, stock quantities, requirements, and risk statuses.
- **AI Connectivity**: Automatically flags items as "Shortage Risk" or "Delayed" during material escalation events, adjusting the project's CPI/SPI accordingly.

---

## 5. Equipment Intelligence
- **What it is**: Machinery log managing heavy equipment on site (e.g. Tower Cranes, Excavators, Concrete Pumps, Wheel Loaders).
- **Metrics**: Tracks status (Active, Idle, Maintenance), active operators, fuel levels, and utilization rates.
- **AI Connectivity**: Switches machines to "Idle" or "Maintenance" and resets utilization to low percentages (e.g. 10%) during storm warnings to simulate automated safety protocols.

---

## 6. Workforce Intelligence
- **What it is**: Subcontractor and labor productivity log.
- **Fields**: Tracks trade teams, headcounts, planned vs. actual labor capacity, headcount variance, and crew productivity levels.

---

## 7. Weather Intelligence
- **What it is**: Displays the real-time weather and 7-day forecast at the construction site location.
- **AI Backend Action**: Uses the OpenWeather API to query conditions (temperature, wind speeds, humidity) and assess weather-related schedule risks.

---

## 8. Risk Intelligence
- **What it is**: A live risk register containing identifiers, probability, impact, and monitoring status.
- **Visuals**: Displays an interactive AI Risk Heatmap mapping probability against severity.

---

## 9. Safety Intelligence
- **What it is**: Log of safety audits, unsafe acts, and near-miss incidents including severity classifications, dates, and locations.

---

## 10. Construction Copilot
- **What it is**: A chat interface powered by a LangGraph agent.
- **RAG Capability**: Enables John Doe (Principal Architect) to ask questions about uploaded project specifications, blueprints, and drawings. The backend uses Qdrant's hybrid search and Cohere Reranking to surface relevant content.
- **Real-Time Tools**: The Copilot can invoke external tools on the fly:
  - `weather_lookup` (OpenWeather API)
  - `web_search` (Tavily API for search queries on codes/costs)
  - `get_project_data` / `update_project_data` (Reads/writes live database values)
  - `vector_store_retrieval` (RAG search)
