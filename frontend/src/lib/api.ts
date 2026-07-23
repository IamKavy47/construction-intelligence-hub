import type { ProjectInfo, ProjectState, DailyReport } from "./types";

export const API_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ??
  "http://127.0.0.1:8000";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      detail = j.detail || detail;
    } catch {
      /* noop */
    }
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  async getState(): Promise<ProjectState> {
    return handle(await fetch(`${API_URL}/api/get-state`));
  },
  async initProject(info: ProjectInfo, doc?: File | null) {
    // If a construction doc is attached, send multipart so the backend can OCR/parse it.
    if (doc) {
      const fd = new FormData();
      fd.append("info", JSON.stringify(info));
      fd.append("document", doc);
      return handle(
        await fetch(`${API_URL}/api/init-project`, {
          method: "POST",
          body: fd,
        }),
      );
    }
    return handle(
      await fetch(`${API_URL}/api/init-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(info),
      }),
    );
  },
  async chat(message: string, active_module: string) {
    return handle<{ response: string; project_state: ProjectState }>(
      await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, active_module }),
      }),
    );
  },
  async upload(file: File, project: ProjectInfo | null) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("projectName", project?.projectName ?? "");
    fd.append("client", project?.client ?? "");
    fd.append("location", project?.location ?? "");
    return handle(
      await fetch(`${API_URL}/api/upload`, { method: "POST", body: fd }),
    );
  },
  async simulate(type?: "weather" | "material") {
    return handle(
      await fetch(`${API_URL}/api/simulate-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: type ?? null }),
      }),
    );
  },
  async refreshWeather() {
    return handle(
      await fetch(`${API_URL}/api/refresh-weather`, { method: "POST" }),
    );
  },
  async estimateMaterials() {
    return handle(
      await fetch(`${API_URL}/api/estimate-materials`, { method: "POST" }),
    );
  },
  async generateReport(): Promise<{ report: DailyReport; project_state: ProjectState }> {
    return handle(
      await fetch(`${API_URL}/api/generate-daily-report`, { method: "POST" }),
    );
  },
  async analyzeRisks() {
    return handle(
      await fetch(`${API_URL}/api/analyze-risks`, { method: "POST" }),
    );
  },
  async analyzeSafety() {
    return handle(
      await fetch(`${API_URL}/api/analyze-safety`, { method: "POST" }),
    );
  },
  async optimizeTimeline() {
    return handle(
      await fetch(`${API_URL}/api/optimize-timeline`, { method: "POST" }),
    );
  },
};
