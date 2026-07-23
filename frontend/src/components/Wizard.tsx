import { useState } from "react";
import { X, Check, Loader2, Upload, FileText } from "lucide-react";
import type { ProjectInfo } from "@/lib/types";
import { useInitProject } from "@/hooks/use-project";

const STEPS = [
  {
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
  },
  {
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
  },
  {
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
  },
  {
    id: "document",
    title: "Construction Document",
    fields: [],
  },
  {
    id: "intelligence",
    title: "Intelligence Settings",
    fields: [
      { id: "aiRisk", label: "Predictive Risk Intelligence", type: "toggle", desc: "AI continuous risk forecasting" },
      { id: "aiWeather", label: "Weather Impact Matrix", type: "toggle", desc: "Auto-adjust schedule based on weather" },
      { id: "aiDocs", label: "Document Conflict Detection", type: "toggle", desc: "Auto-scan drawings for clashes" },
    ],
  },
] as const;

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

export function Wizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<ProjectInfo>(DEFAULTS);
  const [doc, setDoc] = useState<File | null>(null);
  const init = useInitProject();

  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const setField = (id: string, value: unknown) =>
    setData((d) => ({ ...d, [id]: value }));

  const submit = async () => {
    try {
      await init.mutateAsync({ info: data, doc });
      onClose();
      setStep(0);
      setData(DEFAULTS);
      setDoc(null);
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
              Configure AI parameters and project baselines.
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
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setStep(i)}
                className={`w-full text-left flex items-center gap-3 p-3 rounded-lg text-sm transition ${
                  i === step
                    ? "bg-background border border-border font-medium"
                    : "text-[color:var(--muted)] hover:bg-background"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i < step
                      ? "bg-[color:var(--success)] text-white"
                      : i === step
                      ? "bg-primary text-white"
                      : "bg-border text-[color:var(--muted)]"
                  }`}
                >
                  {i < step ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                {s.title}
              </button>
            ))}
          </div>

          <div className="w-2/3 p-8 overflow-y-auto bg-background">
            <h3 className="text-base font-semibold mb-4">{current.title}</h3>

            {current.id === "document" ? (
              <div className="space-y-4">
                <p className="text-sm text-[color:var(--muted)]">
                  Upload your construction document (drawings, room schedule, BOQ, spec book).
                  The AI will parse rooms, floors, gates, windows, and finishes to seed material
                  estimation, risks and safety hazards. Optional — but strongly recommended.
                </p>

                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
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
                        <div className="text-sm font-medium">Click to upload PDF / DOCX / TXT</div>
                        <div className="text-xs text-[color:var(--muted)] mt-1">
                          Max ~20MB. First 50 pages will be parsed by AI.
                        </div>
                      </>
                    )}
                  </div>
                </label>

                {doc && (
                  <button
                    onClick={() => setDoc(null)}
                    className="text-xs text-[color:var(--muted)] hover:text-[color:var(--danger)]"
                  >
                    Remove file
                  </button>
                )}
              </div>
            ) : (
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
                          <p className="text-xs text-[color:var(--muted)] mt-1">
                            {"desc" in f ? f.desc : ""}
                          </p>
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
                          {(f.options as readonly string[]).map((o) => (
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
                        placeholder={"placeholder" in f ? f.placeholder : ""}
                        onChange={(e) =>
                          setField(
                            f.id,
                            f.type === "number"
                              ? Number(e.target.value) || 0
                              : e.target.value,
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
            disabled={step === 0 || init.isPending}
            className="px-4 py-2 text-sm font-medium text-[color:var(--muted)] disabled:opacity-30 hover:text-[color:var(--text-main)]"
          >
            Back
          </button>
          <button
            disabled={init.isPending}
            onClick={() => (isLast ? submit() : setStep((s) => s + 1))}
            className="px-6 py-2 text-sm font-medium bg-[color:var(--text-main)] text-surface rounded-lg hover:bg-black transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {init.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLast
              ? init.isPending
                ? "Initializing with AI..."
                : "Initialize Project"
              : "Next Step"}
          </button>
        </div>
      </div>
    </div>
  );
}
