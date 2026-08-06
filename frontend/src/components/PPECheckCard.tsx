import { useRef, useState } from "react";
import { Camera, Loader2, ShieldCheck, ShieldAlert, X } from "lucide-react";
import { useAnalyzePPE } from "@/hooks/use-project";
import type { PPECheck } from "@/lib/types";

const LABELS: Record<string, string> = {
  helmet: "Helmet",
  high_visibility_vest: "Hi-vis vest",
  safety_harness: "Harness",
  gloves: "Gloves",
  safety_boots: "Boots",
  eye_protection: "Eye protection",
};

export function PPECheckCard({
  checks,
  defaultLocation,
}: {
  checks: PPECheck[];
  defaultLocation: string;
}) {
  const analyze = useAnalyzePPE();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [worker, setWorker] = useState("");
  const [location, setLocation] = useState(defaultLocation);

  function pick(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  function submit() {
    if (!file) return;
    analyze.mutate(
      { image: file, workerName: worker, location },
      {
        onSuccess: () => {
          pick(null);
          setWorker("");
          if (fileRef.current) fileRef.current.value = "";
        },
      },
    );
  }

  const latest = checks[0];

  return (
    <div className="bg-surface border border-border rounded-xl shadow-premium">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Camera className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Worker PPE Check-In (AI Vision)</h3>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              value={worker}
              onChange={(e) => setWorker(e.target.value)}
              placeholder="Worker name"
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
            />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Zone / location"
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
            />
          </div>

          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt="Worker check-in photo awaiting PPE analysis"
                className="w-full h-48 object-cover rounded-lg border border-border"
              />
              <button
                onClick={() => pick(null)}
                aria-label="Remove photo"
                className="absolute top-2 right-2 p-1.5 bg-surface border border-border rounded-lg hover:border-primary"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-48 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition text-center px-4">
              <Camera className="w-6 h-6 text-[color:var(--muted)] mb-2" />
              <span className="text-xs text-[color:var(--muted)]">
                Upload the worker's check-in photo (JPG / PNG, max 12 MB)
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0] ?? null)}
              />
            </label>
          )}

          <button
            onClick={submit}
            disabled={!file || analyze.isPending}
            className="w-full px-4 py-2 bg-[color:var(--text-main)] text-surface rounded-lg text-sm font-medium hover:bg-black transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {analyze.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Analyze PPE Compliance
          </button>
        </div>

        <div className="space-y-3">
          {latest ? (
            <div
              className={`rounded-lg border p-4 ${
                latest.compliant
                  ? "border-[color:var(--success)]/30 bg-[color:var(--success)]/5"
                  : "border-[color:var(--danger)]/30 bg-[color:var(--danger)]/5"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {latest.compliant ? (
                  <ShieldCheck className="w-4 h-4 text-[color:var(--success)]" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-[color:var(--danger)]" />
                )}
                <span className="text-sm font-semibold">
                  {latest.worker} — {latest.compliant ? "Compliant" : `Violation (${latest.severity})`}
                </span>
              </div>
              <p className="text-xs text-[color:var(--muted)]">{latest.summary}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {Object.entries(latest.items ?? {}).map(([k, v]) => (
                  <span
                    key={k}
                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                      v === "present"
                        ? "bg-[color:var(--success)]/10 text-[color:var(--success)]"
                        : v === "missing"
                        ? "bg-[color:var(--danger)]/10 text-[color:var(--danger)]"
                        : "bg-[color:var(--warning)]/10 text-[color:var(--warning)]"
                    }`}
                  >
                    {LABELS[k] ?? k}: {v}
                  </span>
                ))}
              </div>
              {latest.recommendation && (
                <p className="text-xs mt-3">
                  <span className="font-semibold">Action: </span>
                  {latest.recommendation}
                </p>
              )}
            </div>
          ) : (
            <div className="h-full min-h-24 flex items-center justify-center text-xs text-[color:var(--muted)] border border-dashed border-border rounded-lg p-4 text-center">
              No PPE check yet. Upload a worker photo to verify helmet, vest, harness and boots.
            </div>
          )}

          {checks.length > 1 && (
            <div className="border border-border rounded-lg divide-y divide-border max-h-40 overflow-y-auto">
              {checks.slice(1).map((c) => (
                <div key={c.id} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.worker}</div>
                    <div className="text-[10px] text-[color:var(--muted)]">
                      {c.location} · {new Date(c.date).toLocaleString()}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                      c.compliant
                        ? "bg-[color:var(--success)]/10 text-[color:var(--success)]"
                        : "bg-[color:var(--danger)]/10 text-[color:var(--danger)]"
                    }`}
                  >
                    {c.compliant ? "Pass" : "Fail"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
