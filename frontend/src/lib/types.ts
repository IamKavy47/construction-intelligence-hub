export interface ProjectInfo {
  projectName: string;
  client: string;
  location: string;
  projectType: string;
  floors: number;
  builtArea: number;
  structuralSystem: string;
  startDate: string;
  completionDate: string;
  shiftCount: string;
  aiRisk: boolean;
  aiWeather: boolean;
  aiDocs: boolean;
  // Extracted from the wizard-uploaded construction document
  docSummary?: string | null;
}

export interface Alert {
  type: "success" | "warning" | "danger" | "info";
  text: string;
}
export interface Material {
  name: string;
  sku: string;
  supplier: string;
  stock: string;
  required: string;
  status: string;
}
export interface Risk {
  id: string;
  desc: string;
  prob: "Low" | "Medium" | "High";
  impact: "Low" | "Medium" | "High";
  status: string;
  // NEW — AI-driven fields (backend may fill these)
  category?: string;
  mitigation?: string;
  score?: number;
}
export interface SafetyLog {
  id: string;
  date: string;
  type: string;
  location: string;
  desc: string;
  severity: "Low" | "Medium" | "High" | "Info";
}
export interface SafetyHazard {
  id: string;
  hazard: string;
  location: string;
  likelihood: "Low" | "Medium" | "High";
  severity: "Low" | "Medium" | "High";
  control: string;
}
export interface TimelinePhase {
  name: string;
  start: number;   // week offset (0-based)
  length: number;  // weeks
  status: "complete" | "active" | "planned";
  progress?: number; // 0-100
  risk?: "Low" | "Medium" | "High";
  note?: string;
}
export interface UploadedDoc {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedAt: string;
}
export interface WeatherForecast {
  day: string;
  temp: number | string;
  desc: string;
  icon: string;
  risk: string;
  wind: number | string;
}
export interface WeatherReport {
  temp: number | string;
  desc: string;
  wind: string;
  humidity: string;
  location: string;
  updatedAt: string;
  forecast: WeatherForecast[];
}
export interface ChatMessage {
  role: "user" | "bot";
  text: string;
  attachment?: UploadedDoc;
}
export interface SafetyKpis {
  totalIncidentsLogged: number;
  highSeverityIncidents: number;
  auditsLogged: number;
  daysSinceProjectStart: number | null;
  hasLostTimeIncident: boolean;
}
export interface DailyReport {
  date: string;
  summary: string;
  progress: string;
  workDone: string[];
  workPlanned: string[];
  issues: string[];
  weatherImpact: string;
  safetyNotes: string;
  aiRecommendations: string[];
}

export interface ProjectState {
  project: ProjectInfo | null;
  health: number | null;
  cpi: number | null;
  spi: number | null;
  safetyScore: number | null;
  budgetUsed: string | null;
  alerts: Alert[];
  risks: Risk[];
  uploadedDocuments: UploadedDoc[];
  materials: Material[];
  safety: SafetyLog[];
  safetyHazards?: SafetyHazard[];
  timeline?: TimelinePhase[];
  weatherReport: WeatherReport | null;
  chatHistory: ChatMessage[];
  safetyKpis: SafetyKpis | null;
  dailyReports?: DailyReport[];
}

export type ModuleId =
  | "dashboard"
  | "timeline"
  | "material"
  | "risk"
  | "safety"
  | "report"
  | "copilot";
