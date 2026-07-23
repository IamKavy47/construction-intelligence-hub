import type { ProjectState } from "@/lib/types";
import { useEstimateMaterials } from "@/hooks/use-project";
import { Loader2, RefreshCw } from "lucide-react";

function statusClass(status: string) {
  const s = status.toLowerCase();
  if (s.includes("healthy") || s.includes("on track") || s.includes("ok"))
    return "bg-[color:var(--success)]/10 text-[color:var(--success)]";
  if (s.includes("delayed") || s.includes("short"))
    return "bg-[color:var(--danger)]/10 text-[color:var(--danger)]";
  return "bg-[color:var(--warning)]/10 text-[color:var(--warning)]";
}

export function Material({
  state,
  onAskCopilot,
}: {
  state: ProjectState;
  onAskCopilot: (q: string) => void;
}) {
  const est = useEstimateMaterials();
  const shortages = state.materials.filter((m) =>
    /short|delay/i.test(m.status),
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Material Intelligence</h1>
          <p className="text-[color:var(--muted)] text-sm mt-1">
            AI-driven procurement, inventory tracking, and shortage forecasting.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              onAskCopilot("Suggest procurement actions for materials at risk of shortage this week.")
            }
            className="px-3 py-2 bg-surface border border-border rounded-lg text-xs font-medium hover:border-primary transition"
          >
            AI Procurement Advice
          </button>
          <button
            onClick={() => est.mutate()}
            disabled={est.isPending}
            className="px-4 py-2 bg-[color:var(--text-main)] text-surface rounded-lg text-sm font-medium hover:bg-black transition flex items-center gap-2 disabled:opacity-60"
          >
            {est.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Re-run AI Estimation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Tracked Items" value={String(state.materials.length)} />
        <StatCard label="Predicted Shortages" value={String(shortages)} tone={shortages ? "danger" : "muted"} />
        <StatCard label="Est. Data Source" value="AI Takeoff" />
        <StatCard label="Baseline" value={state.project?.structuralSystem ?? "—"} />
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-premium">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-sm">Critical Material Tracking</h3>
        </div>
        {state.materials.length === 0 ? (
          <div className="p-8 text-center text-sm text-[color:var(--muted)]">
            No materials estimated yet. Click <b>Re-run AI Estimation</b> or ask the Copilot.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-[color:var(--muted)] uppercase bg-background/50">
                <tr>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Required</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {state.materials.map((m) => (
                  <tr key={m.sku} className="border-b border-border last:border-0 hover:bg-background/40">
                    <td className="px-4 py-3">
                      <div className="font-medium">{m.name}</div>
                      <div className="text-[10px] text-[color:var(--muted)]">{m.supplier}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{m.stock}</td>
                    <td className="px-4 py-3 font-mono text-xs">{m.required}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${statusClass(m.status)}`}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "danger" | "muted" }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-premium">
      <div className="text-[color:var(--muted)] text-xs font-medium uppercase tracking-wider mb-2">
        {label}
      </div>
      <div className={`text-3xl font-bold ${tone === "danger" ? "text-[color:var(--danger)]" : ""}`}>
        {value}
      </div>
    </div>
  );
}
