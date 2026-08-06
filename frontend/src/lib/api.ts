import type {
  ProjectInfo,
  ProjectState,
  DailyReport,
  PPECheck,
  RiskEngine,
  WorkflowItem,
  ExecutiveSummary,
  NotificationRecord,
} from "./types";

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
    // Upload the construction document through the working /api/upload endpoint
    // first (silent = index only, reset = clear the previous project's index),
    // then call init-project so the AI baseline is grounded in that document.
    if (doc) {
      await api.upload(doc, info, { silent: true, reset: true });
      return handle(
        await fetch(`${API_URL}/api/init-project`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...info, hasDocument: true, documentName: doc.name }),
        }),
      );
    }
    return handle(
      await fetch(`${API_URL}/api/init-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...info, hasDocument: false }),
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
  /**
   * Streaming chat: the backend emits SSE events so the reply types out live.
   * Falls back to the buffered /api/chat endpoint if streaming isn't available.
   */
  async chatStream(
    message: string,
    active_module: string,
    on: {
      onToken?: (text: string) => void;
      onReset?: () => void;
      onTools?: (names: string[]) => void;
    },
  ): Promise<{ response: string; project_state: ProjectState }> {
    const res = await fetch(`${API_URL}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, active_module }),
    });
    if (res.status === 404 || res.status === 405) {
      return api.chat(message, active_module);
    }
    if (!res.ok || !res.body) {
      let detail = `Request failed (${res.status})`;
      try {
        detail = (await res.json()).detail || detail;
      } catch {
        /* noop */
      }
      throw new Error(detail);
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    let done: { response: string; project_state: ProjectState } | null = null;

    for (;;) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      buffer += value;
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const line = frame.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        let evt: Record<string, unknown>;
        try {
          evt = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (evt.type === "token") on.onToken?.(String(evt.text ?? ""));
        else if (evt.type === "reset") on.onReset?.();
        else if (evt.type === "tools") on.onTools?.((evt.names as string[]) ?? []);
        else if (evt.type === "error") throw new Error(String(evt.detail ?? "AI engine error"));
        else if (evt.type === "done")
          done = {
            response: String(evt.response ?? ""),
            project_state: evt.project_state as ProjectState,
          };
      }
    }

    if (!done) throw new Error("The AI stream ended unexpectedly.");
    return done;
  },
  /** MongoDB-backed project list, newest first. */
  async listProjects() {
    return handle<{
      projects: {
        id: string;
        project: ProjectInfo | null;
        createdAt: string;
        updatedAt: string;
      }[];
    }>(await fetch(`${API_URL}/api/db/projects`));
  },
  /** Makes a saved project the active one again. */
  async loadProject(id: string) {
    return handle<{ project_state: ProjectState }>(
      await fetch(`${API_URL}/api/db/load-project/${encodeURIComponent(id)}`, {
        method: "POST",
      }),
    );
  },

  async upload(
    file: File,
    project: ProjectInfo | null,
    opts?: { silent?: boolean; reset?: boolean },
  ) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("projectName", project?.projectName ?? "");
    fd.append("client", project?.client ?? "");
    fd.append("location", project?.location ?? "");
    fd.append("silent", opts?.silent ? "true" : "false");
    fd.append("reset", opts?.reset ? "true" : "false");
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
  /** Gemini vision PPE check on a worker check-in photo. */
  async analyzePPE(image: File, workerName: string, location: string) {
    const fd = new FormData();
    fd.append("file", image);
    fd.append("workerName", workerName);
    fd.append("location", location);
    return handle<{ check: PPECheck; project_state: ProjectState }>(
      await fetch(`${API_URL}/api/analyze-ppe`, { method: "POST", body: fd }),
    );
  },
  /** Construction Risk Intelligence Engine: weighted score, patterns, predictions. */
  async runRiskEngine() {
    return handle<{ engine: RiskEngine; project_state: ProjectState }>(
      await fetch(`${API_URL}/api/risk-engine`, { method: "POST" }),
    );
  },
  async executiveSummary(): Promise<ExecutiveSummary> {
    return handle(await fetch(`${API_URL}/api/executive-summary`));
  },
  async listWorkflows() {
    return handle<{ workflows: WorkflowItem[] }>(await fetch(`${API_URL}/api/workflows`));
  },
  async upsertWorkflow(item: Partial<WorkflowItem>) {
    return handle<{ workflow: WorkflowItem; project_state: ProjectState }>(
      await fetch(`${API_URL}/api/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      }),
    );
  },
  async deleteWorkflow(id: string) {
    return handle<{ project_state: ProjectState }>(
      await fetch(`${API_URL}/api/workflows/${id}`, { method: "DELETE" }),
    );
  },
  /** Runs escalation rules over the live state and fires notifications. */
  async escalationScan() {
    return handle<{ fired: NotificationRecord[]; project_state: ProjectState }>(
      await fetch(`${API_URL}/api/escalate/scan`, { method: "POST" }),
    );
  },
  /** Downloads an audit-ready PDF ("daily-report" or "executive-summary"). */
  async downloadPdf(kind: "daily-report" | "executive-summary") {
    const res = await fetch(`${API_URL}/api/export/${kind}`);
    if (!res.ok) {
      let detail = `Export failed (${res.status})`;
      try {
        detail = (await res.json()).detail || detail;
      } catch {
        /* noop */
      }
      throw new Error(detail);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  /** Sarvam AI speech-to-text. languageCode "unknown" = auto-detect. */
  async transcribe(audio: Blob, languageCode = "unknown") {
    const fd = new FormData();
    fd.append("file", audio, "recording.wav");
    fd.append("language_code", languageCode);
    return handle<{ transcript: string; language_code: string }>(
      await fetch(`${API_URL}/api/stt`, { method: "POST", body: fd }),
    );
  },
  /** Sarvam AI text-to-speech. Returns base64 WAV segments in order. */
  async speak(text: string, targetLanguageCode = "en-IN") {
    return handle<{ audios: string[]; format: string }>(
      await fetch(`${API_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target_language_code: targetLanguageCode }),
      }),
    );
  },
};

