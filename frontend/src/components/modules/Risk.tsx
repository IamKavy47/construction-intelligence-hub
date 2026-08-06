import type { ProjectState } from "@/lib/types";
import { WeatherWidget } from "@/components/WeatherWidget";
import { RiskEngineCard } from "@/components/RiskEngineCard";
import { WorkflowBoard } from "@/components/WorkflowBoard";
import { useAnalyzeRisks } from "@/hooks/use-project";
import { Loader2, Sparkles } from "lucide-react";

const LEVELS: Array<"Low" | "Medium" | "High"> = ["Low", "Medium", "High"];

export function Risk({
  state,
  onAskCopilot,
}: {
  state: ProjectState;
  onAskCopilot: (q: string) => void;
}) {
  const analyze = useAnalyzeRisks();
  const grid = LEVELS.map(() => LEVELS.map(() => 0));
  state.risks.forEach((r) => {
    const pi = LEVELS.indexOf(r.prob);
    const ii = LEVELS.indexOf(r.impact);
    if (pi >= 0 && ii >= 0) grid[pi][ii]++;
  });
  const max = Math.max(1, ...grid.flat());

  const cellClass = (n: number) => {
    if (n === 0) return "bg-background text-[color:var(--muted)]";
    const r = n / max;
    if (r > 0.66) return "bg-[color:var(--danger)]/80 text-white";
    if (r > 0.33) return "bg-[color:var(--warning)]/60";
    return "bg-[color:var(--success)]/30";
  };

  const topRisks = [...state.risks]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Risk Intelligence</h1>
          <p className="text-[color:var(--muted)] text-sm mt-1">
            Predictive risk matrix, mitigation tracking, and site weather impact.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              onAskCopilot(
                "Analyze the risk register and propose new mitigations, given current weather and materials.",
              )
            }
            className="px-3 py-2 bg-surface border border-border rounded-lg text-xs font-medium hover:border-primary transition"
          >
            Ask AI for mitigations
          </button>
          <button
            onClick={() => analyze.mutate()}
            disabled={analyze.isPending}
            className="px-4 py-2 bg-[color:var(--text-main)] text-surface rounded-lg text-sm font-medium hover:bg-black transition flex items-center gap-2 disabled:opacity-60"
          >
            {analyze.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Re-analyze with AI
          </button>
        </div>
      </div>

      <RiskEngineCard engine={state.riskEngine} />

      <WeatherWidget report={state.weatherReport} />

      {topRisks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topRisks.map((r) => (
            <div
              key={r.id}
              className="bg-surface border border-border rounded-xl p-4 shadow-premium"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] uppercase tracking-wider text-[color:var(--muted)] font-bold">
                  {r.category ?? "Risk"} · {r.id}
                </span>
                <Chip level={r.impact} />
              </div>
              <p className="text-sm font-medium leading-snug">{r.desc}</p>
              {r.mitigation && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-[10px] uppercase text-[color:var(--muted)] mb-1 font-semibold">
                    AI Mitigation
                  </div>
                  <p className="text-xs text-[color:var(--text-main)] leading-relaxed">
                    {r.mitigation}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-surface border border-border rounded-xl p-5 shadow-premium">
          <h3 className="font-semibold text-sm mb-4">Risk Register</h3>
          {state.risks.length === 0 ? (
            <div className="text-sm text-[color:var(--muted)] py-8 text-center">
              No risks logged yet. Click <b>Re-analyze with AI</b>.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-[color:var(--muted)] uppercase bg-background/50">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">P</th>
                    <th className="px-4 py-3">I</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {state.risks.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-background/40">
                      <td className="px-4 py-3 font-medium">{r.id}</td>
                      <td className="px-4 py-3">
                        <div>{r.desc}</div>
                        {r.mitigation && (
                          <div className="text-[10px] text-[color:var(--muted)] mt-1">
                            → {r.mitigation}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3"><Chip level={r.prob} /></td>
                      <td className="px-4 py-3"><Chip level={r.impact} /></td>
                      <td className="px-4 py-3 text-[color:var(--muted)] text-xs">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-premium">
          <h3 className="font-semibold text-sm mb-4">
            Risk Heatmap{" "}
            <span className="text-[color:var(--muted)] font-normal text-xs">
              (P × I)
            </span>
          </h3>
          <div className="grid grid-cols-3 grid-rows-3 gap-1 h-48">
            {grid.flatMap((row, pi) =>
              row.map((n, ii) => (
                <div
                  key={`${pi}-${ii}`}
                  className={`${cellClass(n)} flex items-center justify-center text-xs font-semibold rounded`}
                >
                  {n}
                </div>
              )),
            )}
          </div>
          <div className="mt-4 text-xs text-[color:var(--muted)] flex justify-between">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      </div>

      <WorkflowBoard
        workflows={state.workflows ?? []}
        notifications={state.notificationsLog ?? []}
      />
    </div>
  );
}

function Chip({ level }: { level: "Low" | "Medium" | "High" }) {
  const cls =
    level === "High"
      ? "bg-[color:var(--danger)]/10 text-[color:var(--danger)]"
      : level === "Medium"
      ? "bg-[color:var(--warning)]/10 text-[color:var(--warning)]"
      : "bg-[color:var(--success)]/10 text-[color:var(--success)]";
  return <span className={`px-2 py-1 rounded text-xs ${cls}`}>{level}</span>;
}
