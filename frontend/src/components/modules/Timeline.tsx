import type { ProjectState } from "@/lib/types";
import { Siren, Loader2, Sparkles } from "lucide-react";
import { useOptimizeTimeline } from "@/hooks/use-project";

import type { TimelinePhase } from "@/lib/types";

const FALLBACK: TimelinePhase[] = [
  { name: "Planning & Permits", start: 0, length: 1.2, status: "complete", progress: 100 },
  { name: "Site Prep & Substructure", start: 1, length: 1.5, status: "complete", progress: 100 },
  { name: "Superstructure", start: 2, length: 2, status: "active", progress: 45 },
  { name: "Facade & Cladding", start: 3, length: 1.8, status: "planned", risk: "High" },
  { name: "MEP Rough-in", start: 3.2, length: 1.6, status: "planned" },
  { name: "Interior Fit-Out", start: 4, length: 1.5, status: "planned" },
  { name: "Handover", start: 4.6, length: 0.4, status: "planned" },
];

export function Timeline({
  state,
  onAskCopilot,
}: {
  state: ProjectState;
  onAskCopilot: (q: string) => void;
}) {
  const opt = useOptimizeTimeline();
  const phases = state.timeline && state.timeline.length > 0 ? state.timeline : FALLBACK;
  const maxWeek = Math.max(5, ...phases.map((p) => p.start + p.length));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Timeline Intelligence</h1>
          <p className="text-[color:var(--muted)] text-sm mt-1">
            AI-optimized critical path, phase progress and delay forecasting.
          </p>
        </div>
        <button
          onClick={() => opt.mutate()}
          disabled={opt.isPending}
          className="px-4 py-2 bg-[color:var(--text-main)] text-surface rounded-lg text-sm font-medium hover:bg-black transition flex items-center gap-2 disabled:opacity-60"
        >
          {opt.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Re-optimize with AI
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 flex items-start gap-4">
        <div className="p-2 bg-[color:var(--warning)]/10 rounded-lg text-[color:var(--warning)] flex-shrink-0">
          <Siren className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold">Delay Risk Analysis</h4>
          <p className="text-sm text-[color:var(--muted)] mt-1">
            Ask AI to reason about delay risk using current weather, material shortages, and the risk register.
          </p>
          <button
            onClick={() =>
              onAskCopilot(
                "Analyze current risks, materials, and weather to predict potential delays and propose schedule adjustments.",
              )
            }
            className="mt-3 text-xs bg-[color:var(--text-main)] text-surface px-3 py-1.5 rounded-md hover:bg-black transition"
          >
            Run Delay Risk Analysis
          </button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-premium overflow-hidden flex flex-col">
        <div className="flex border-b border-border bg-background/50 text-xs font-medium text-[color:var(--muted)]">
          <div className="w-64 p-3 border-r border-border flex-shrink-0">Phase</div>
          <div className="flex-1 flex">
            {Array.from({ length: Math.ceil(maxWeek) }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 p-3 text-center border-r border-border last:border-0 ${
                  i === 2 ? "bg-primary/5 text-primary" : ""
                }`}
              >
                W{i + 1}
              </div>
            ))}
          </div>
        </div>
        {phases.map((r, i) => (
          <div key={i} className="flex border-b border-border last:border-0 h-16 hover:bg-background/40">
            <div className="w-64 p-3 border-r border-border flex-shrink-0 text-sm font-medium flex flex-col justify-center">
              <div>{r.name}</div>
              {r.note && (
                <div className="text-[10px] text-[color:var(--muted)] mt-0.5 truncate">{r.note}</div>
              )}
            </div>
            <div className="flex-1 flex relative">
              {Array.from({ length: Math.ceil(maxWeek) }).map((_, c) => (
                <div key={c} className="flex-1 border-r border-border/50 last:border-0" />
              ))}
              <div
                className={`absolute top-1/2 -translate-y-1/2 h-7 rounded-md border shadow-sm overflow-hidden ${
                  r.status === "complete"
                    ? "bg-[color:var(--success)]/20 border-[color:var(--success)]/40"
                    : r.status === "active"
                    ? "bg-primary/20 border-primary/60"
                    : r.risk === "High"
                    ? "bg-[color:var(--danger)]/15 border-[color:var(--danger)]/40"
                    : r.risk === "Medium"
                    ? "bg-[color:var(--warning)]/20 border-[color:var(--warning)]/40"
                    : "bg-surface border-border"
                }`}
                style={{
                  left: `${(r.start / maxWeek) * 100}%`,
                  width: `${(r.length / maxWeek) * 100}%`,
                }}
              >
                {typeof r.progress === "number" && r.progress > 0 && (
                  <div
                    className="h-full bg-primary/60"
                    style={{ width: `${Math.min(100, r.progress)}%` }}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
