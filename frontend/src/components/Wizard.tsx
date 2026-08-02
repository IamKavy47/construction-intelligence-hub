import { useState } from "react";
import { X, Check, Loader2, Upload, FileText, PencilLine, FileUp } from "lucide-react";
import type { ProjectInfo } from "@/lib/types";
import { useInitProject } from "@/hooks/use-project";

type Field = {
  id: string;
  label: string;
  type: "text" | "number" | "select" | "date" | "toggle";
  placeholder?: string;
  options?: readonly string[];
  desc?: string;
};

type Step = { id: string; title: string; fields: Field[] };

const STEP_MODE: Step = { id: "mode", title: "Setup Method", fields: [] };

const STEP_BASIC: Step = {
  id: "basic",
  title: "Basic Information",
  fields: [
    { id: "projectName", label: "Project Name", type: "text", placeholder: "e.g. Apex Tower" },
    { id: "client", label: "Client", type: "text", placeholder: "Client Name" },
    { id: "location", label: "Location", type: "text", placeholder: "City, Country" },
    {
      id: "projectType",
      label: "Project Type",
      type: "select",
      options: ["Residential", "Commercial", "Industrial", "Infrastructure"],
    },
  ],
};

const STEP_BUILDING: Step = {
  id: "building",
  title: "Building Information",
  fields: [
    { id: "floors", label: "Total Floors", type: "number", placeholder: "0" },
    { id: "builtArea", label: "Built Area (sqm)", type: "number", placeholder: "0" },
    {
      id: "structuralSystem",
      label: "Structural System",
      type: "select",
      options: ["RC Frame", "Steel Frame", "Composite", "Precast"],
    },
  ],
};

const STEP_SCHEDULE: Step = {
  id: "schedule",
  title: "Schedule Baseline",
  fields: [
    { id: "startDate", label: "Start Date", type: "date" },
    { id: "completionDate", label: "Target Completion", type: "date" },
    {
      id: "shiftCount",
      label: "Shift Count",
      type: "select",
      options: ["1 Shift", "2 Shifts", "24/7 Operations"],
    },
  ],
};

const STEP_DOCUMENT: Step = { id: "document", title: "Construction Document", fields: [] };

const STEP_INTELLIGENCE: Step = {
  id: "intelligence",
  title: "Intelligence Settings",
  fields: [
    { id: "aiRisk", label: "Predictive Risk Intelligence", type: "toggle", desc: "AI continuous risk forecasting" },
    { id: "aiWeather", label: "Weather Impact Matrix", type: "toggle", desc: "Auto-adjust schedule based on weather" },
    { id: "aiDocs", label: "Document Conflict Detection", type: "toggle", desc: "Auto-scan drawings for clashes" },
  ],
};

const DEFAULTS: ProjectInfo = {
  projectName: "",
  client: "",
  location: "",
  projectType: "Commercial",
  floors: 0,
  builtArea: 0,
  structuralSystem: "RC Frame",
  startDate: "",
  completionDate: "",
  shiftCount: "1 Shift",
  aiRisk: true,
  aiWeather: true,
  aiDocs: true,
};

type Mode = "manual" | "document" | null;

export function Wizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>(null);
  const [data, setData] = useState<ProjectInfo>(DEFAULTS);
  const [doc, setDoc] = useState<File | null>(null);
  const init = useInitProject();

  if (!open) return null;

  const steps: Step[] =
    mode === "document"
      ? [STEP_MODE, STEP_DOCUMENT, STEP_INTELLIGENCE]
      : mode === "manual"
      ? [STEP_MODE, STEP_BASIC, STEP_BUILDING, STEP_SCHEDULE, STEP_DOCUMENT, STEP_INTELLIGENCE]
      : [STEP_MODE];

  const safeStep = Math.min(step, steps.length - 1);
  const current = steps[safeStep];
  const isLast = safeStep === steps.length - 1;

  const nextDisabled =
    (current.id === "mode" && !mode) || (current.id === "document" && mode === "document" && !doc);

  const setField = (id: string, value: unknown) => setData((d) => ({ ...d, [id]: value }));

  const reset = () => {
    setStep(0);
    setMode(null);
    setData(DEFAULTS);
    setDoc(null);
  };

  const submit = async () => {
    try {
      await init.mutateAsync({ info: data, doc });
      onClose();
      reset();
    } catch {
      /* toast handled in hook */
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-border">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-surface">
          <div>
            <h2 className="text-lg font-semibold">Project Intelligence Setup</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Enter project details, or let the AI read your construction document.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[color:var(--muted)] hover:bg-border rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-1/3 border-r border-border bg-surface/50 p-6 space-y-2 overflow-y-auto">
            {steps.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setStep(i)}
                className={`w-full text-left flex items-center gap-3 p-3 rounded-lg text-sm transition ${
                  i === safeStep
                    ? "bg-background border border-border font-medium"
                    : "text-[color:var(--muted)] hover:bg-background"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i < safeStep
                      ? "bg-[color:var(--success)] text-white"
                      : i === safeStep
                      ? "bg-primary text-white"
                      : "bg-border text-[color:var(--muted)]"
                  }`}
                >
                  {i < safeStep ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                {s.title}
              </button>
            ))}
          </div>

          <div className="w-2/3 p-8 overflow-y-auto bg-background">
            <h3 className="text-base font-semibold mb-4">{current.title}</h3>

            {current.id === "mode" && (
              <div className="space-y-3">
                <p className="text-sm text-[color:var(--muted)]">
                  How would you like to set this project up? Both paths produce the same
                  AI-generated baseline — materials, risks, safety and metrics.
                </p>
                {[
                  {
                    id: "manual" as const,
                    icon: PencilLine,
                    title: "Enter project details",
                    desc: "Fill in name, client, floors, area, structural system and schedule. You can still attach a document later in the flow.",
                  },
                  {
                    id: "document" as const,
                    icon: FileUp,
                    title: "Upload construction document",
                    desc: "Upload a PDF, DOCX, MD or TXT with rooms, floors, area, gates, windows, finishes or BOQ. The AI extracts the project details from it and seeds every module.",
                  },
                ].map((o) => (
                  <button
                    key={o.id}
                    onClick={() => {
                      setMode(o.id);
                      setStep(1);
                    }}
                    className={`w-full text-left flex gap-4 p-4 rounded-xl border transition ${
                      mode === o.id
                        ? "border-primary bg-surface"
                        : "border-border hover:border-primary hover:bg-surface/50"
                    }`}
                  >
                    <o.icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">{o.title}</div>
                      <div className="text-xs text-[color:var(--muted)] mt-1 leading-relaxed">
                        {o.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {current.id === "document" && (
              <div className="space-y-4">
                <p className="text-sm text-[color:var(--muted)]">
                  {mode === "document"
                    ? "Upload your construction document. The AI reads it, extracts the project name, client, location, floors, area and structural system, and grounds material estimation, risks and safety in its actual contents."
                    : "Optionally attach a construction document (drawings, room schedule, BOQ, spec book). The AI will use it to ground material estimation, risks and safety."}
                </p>

                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.md,.csv"
                    className="hidden"
                    onChange={(e) => setDoc(e.target.files?.[0] ?? null)}
                  />
                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary hover:bg-surface/50 transition">
                    {doc ? (
                      <div className="flex items-center justify-center gap-3">
                        <FileText className="w-6 h-6 text-primary" />
                        <div className="text-left">
                          <div className="text-sm font-medium">{doc.name}</div>
                          <div className="text-xs text-[color:var(--muted)]">
                            {(doc.size / 1024).toFixed(1)} KB — click to replace
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-[color:var(--muted)] mx-auto mb-2" />
                        <div className="text-sm font-medium">
                          Click to upload PDF / DOCX / MD / TXT
                        </div>
                        <div className="text-xs text-[color:var(--muted)] mt-1">
                          Text is extracted and indexed for AI retrieval before the baseline runs.
                        </div>
                      </>
                    )}
                  </div>
                </label>

                {mode === "document" && (
                  <div>
                    <label className="text-xs font-medium text-[color:var(--muted)] mb-1 block">
                      Project Name (optional — AI fills this from the document)
                    </label>
                    <input
                      type="text"
                      value={data.projectName}
                      placeholder="Leave blank to let the AI extract it"
                      onChange={(e) => setField("projectName", e.target.value)}
                      className="w-full bg-surface border border-border rounded-lg p-2 text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                )}

                {doc && (
                  <button
                    onClick={() => setDoc(null)}
                    className="text-xs text-[color:var(--muted)] hover:text-[color:var(--danger)]"
                  >
                    Remove file
                  </button>
                )}
              </div>
            )}

            {current.fields.length > 0 && (
              <div className="space-y-4">
                {current.fields.map((f) => {
                  const key = f.id as keyof ProjectInfo;
                  const value = data[key];
                  if (f.type === "toggle") {
                    const checked = Boolean(value);
                    return (
                      <div
                        key={f.id}
                        className="flex items-start justify-between gap-4 p-4 border border-border rounded-lg bg-surface/40"
                      >
                        <div>
                          <p className="text-sm font-medium">{f.label}</p>
                          <p className="text-xs text-[color:var(--muted)] mt-1">{f.desc ?? ""}</p>
                        </div>
                        <button
                          onClick={() => setField(f.id, !checked)}
                          className={`w-10 h-6 rounded-full transition ${
                            checked ? "bg-primary" : "bg-border"
                          } flex items-center p-0.5`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white transition-transform ${
                              checked ? "translate-x-4" : ""
                            }`}
                          />
                        </button>
                      </div>
                    );
                  }
                  if (f.type === "select") {
                    return (
                      <div key={f.id}>
                        <label className="text-xs font-medium text-[color:var(--muted)] mb-1 block">
                          {f.label}
                        </label>
                        <select
                          value={String(value)}
                          onChange={(e) => setField(f.id, e.target.value)}
                          className="w-full bg-surface border border-border rounded-lg p-2 text-sm focus:outline-none focus:border-primary"
                        >
                          {(f.options ?? []).map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  return (
                    <div key={f.id}>
                      <label className="text-xs font-medium text-[color:var(--muted)] mb-1 block">
                        {f.label}
                      </label>
                      <input
                        type={f.type}
                        value={String(value ?? "")}
                        placeholder={f.placeholder ?? ""}
                        onChange={(e) =>
                          setField(
                            f.id,
                            f.type === "number" ? Number(e.target.value) || 0 : e.target.value,
                          )
                        }
                        className="w-full bg-surface border border-border rounded-lg p-2 text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-between items-center bg-surface">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={safeStep === 0 || init.isPending}
            className="px-4 py-2 text-sm font-medium text-[color:var(--muted)] disabled:opacity-30 hover:text-[color:var(--text-main)]"
          >
            Back
          </button>
          <button
            disabled={init.isPending || nextDisabled}
            onClick={() => (isLast ? submit() : setStep((s) => s + 1))}
            className="px-6 py-2 text-sm font-medium bg-[color:var(--text-main)] text-surface rounded-lg hover:bg-black transition-colors flex items-center gap-2 disabled:opacity-40"
          >
            {init.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLast
              ? init.isPending
                ? "Reading document & initializing..."
                : "Initialize Project"
              : "Next Step"}
          </button>
        </div>
      </div>
    </div>
  );
}
