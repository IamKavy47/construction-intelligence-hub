import type { ModuleId } from "./types";

export interface ModuleDef {
  id: ModuleId;
  name: string;
  icon: string;
}

export const MODULES: ModuleDef[] = [
  { id: "dashboard", name: "Dashboard", icon: "LayoutDashboard" },
  { id: "timeline", name: "Timeline Intelligence", icon: "GitCommit" },
  { id: "material", name: "Material Intelligence", icon: "Box" },
  { id: "risk", name: "Risk Intelligence", icon: "ShieldAlert" },
  { id: "safety", name: "Safety Intelligence", icon: "HardHat" },
  { id: "report", name: "Daily Report", icon: "FileText" },
  { id: "executive", name: "Executive View", icon: "Briefcase" },
  { id: "copilot", name: "Construction Copilot", icon: "Bot" },
];

export const AI_SUGGESTIONS: Record<ModuleId | "default", string[]> = {
  dashboard: ["Summarize project health", "Generate executive report", "Why is SPI low?"],
  timeline: ["Predict project delays", "Critical path analysis", "Optimize schedule"],
  material: ["Forecast steel shortage", "Optimize procurement", "Recalculate takeoff from doc"],
  risk: ["Analyze top 3 risks", "Wind/storm schedule impact", "Update risk register"],
  safety: ["Identify high risk zones", "Weather-related hazards today", "Generate toolbox talk"],
  report: ["Generate today's DPR", "Summarize last 7 days", "Draft client update email"],
  executive: ["Summarize project health for the client", "Biggest cost & schedule exposures", "Draft board update"],
  copilot: ["Upload a drawing for clash check", "Summarize uploaded document", "Find missing information"],
  default: ["Analyze data", "Find anomalies", "Generate summary"],
};
