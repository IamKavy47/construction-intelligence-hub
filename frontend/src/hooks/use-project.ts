import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ProjectInfo, ProjectState } from "@/lib/types";
import { toast } from "sonner";

export function useProjectState() {
  return useQuery<ProjectState, Error>({
    queryKey: ["project-state"],
    queryFn: () => api.getState(),
    refetchInterval: false,
    retry: 1,
  });
}

export function useInitProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ info, doc }: { info: ProjectInfo; doc?: File | null }) =>
      api.initProject(info, doc ?? null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-state"] });
      qc.invalidateQueries({ queryKey: ["db-projects"] });
      toast.success("Project initialized with AI baseline");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Streaming chat. `onToken` receives text as the model types it. */
export function useChat(on?: {
  onToken?: (text: string) => void;
  onReset?: () => void;
  onTools?: (names: string[]) => void;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ message, module }: { message: string; module: string }) =>
      api.chatStream(message, module, {
        onToken: on?.onToken,
        onReset: on?.onReset,
        onTools: on?.onTools,
      }),
    onSuccess: (data) => {
      if (data?.project_state) qc.setQueryData(["project-state"], data.project_state);
      qc.invalidateQueries({ queryKey: ["project-state"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** All projects saved in MongoDB, for the header project switcher. */
export function useProjects() {
  return useQuery({
    queryKey: ["db-projects"],
    queryFn: () => api.listProjects().then((r) => r.projects),
    retry: 0,
    staleTime: 30_000,
  });
}

export function useLoadProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.loadProject(id),
    onSuccess: (data) => {
      if (data?.project_state) qc.setQueryData(["project-state"], data.project_state);
      qc.invalidateQueries({ queryKey: ["project-state"] });
      toast.success("Project loaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, project }: { file: File; project: ProjectInfo | null }) =>
      api.upload(file, project),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-state"] }),
    onError: (e: Error) => toast.error(`Upload failed: ${e.message}`),
  });
}

export function useSimulate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (type?: "weather" | "material") => api.simulate(type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-state"] });
      toast.success("AI event simulation complete");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRefreshWeather() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.refreshWeather(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-state"] });
      toast.success("Weather refreshed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useEstimateMaterials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.estimateMaterials(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-state"] });
      toast.success("Material estimation refreshed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.generateReport(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-state"] });
      toast.success("Daily report generated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAnalyzeRisks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.analyzeRisks(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-state"] });
      toast.success("Risk analysis updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAnalyzeSafety() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.analyzeSafety(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-state"] });
      toast.success("Safety analysis updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAnalyzePPE() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ image, workerName, location }: { image: File; workerName: string; location: string }) =>
      api.analyzePPE(image, workerName, location),
    onSuccess: (data) => {
      if (data?.project_state) qc.setQueryData(["project-state"], data.project_state);
      qc.invalidateQueries({ queryKey: ["project-state"] });
      toast[data.check.compliant ? "success" : "error"](
        data.check.compliant ? "PPE check passed" : `PPE violation: ${data.check.violations.join(", ")}`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useOptimizeTimeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.optimizeTimeline(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-state"] });
      toast.success("Timeline optimized");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Construction Risk Intelligence Engine — weighted score, patterns, predictions. */
export function useRiskEngine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.runRiskEngine(),
    onSuccess: (data) => {
      if (data?.project_state) qc.setQueryData(["project-state"], data.project_state);
      qc.invalidateQueries({ queryKey: ["project-state"] });
      qc.invalidateQueries({ queryKey: ["executive-summary"] });
      toast.success(`Risk score ${data.engine.score} (${data.engine.grade})`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useExecutiveSummary(enabled = true) {
  return useQuery({
    queryKey: ["executive-summary"],
    queryFn: () => api.executiveSummary(),
    enabled,
    retry: 0,
  });
}

export function useUpsertWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: Parameters<typeof api.upsertWorkflow>[0]) => api.upsertWorkflow(item),
    onSuccess: (data) => {
      if (data?.project_state) qc.setQueryData(["project-state"], data.project_state);
      qc.invalidateQueries({ queryKey: ["executive-summary"] });
      toast.success("Mitigation task saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteWorkflow(id),
    onSuccess: (data) => {
      if (data?.project_state) qc.setQueryData(["project-state"], data.project_state);
      qc.invalidateQueries({ queryKey: ["executive-summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useEscalationScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.escalationScan(),
    onSuccess: (data) => {
      if (data?.project_state) qc.setQueryData(["project-state"], data.project_state);
      qc.invalidateQueries({ queryKey: ["executive-summary"] });
      toast.success(
        data.fired.length
          ? `${data.fired.length} escalation${data.fired.length > 1 ? "s" : ""} raised`
          : "No escalation thresholds breached",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Downloads an audit-ready PDF export. */
export function useExportPdf() {
  return useMutation({
    mutationFn: (kind: "daily-report" | "executive-summary") => api.downloadPdf(kind),
    onSuccess: () => toast.success("PDF downloaded"),
    onError: (e: Error) => toast.error(e.message),
  });
}
