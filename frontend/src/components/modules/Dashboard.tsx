import type { ProjectState } from "@/lib/types";
import { Activity, DollarSign, Clock, ShieldCheck, TrendingUp, ArrowUpRight, ArrowDownRight, AlertCircle, Sparkles, Download } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

function Kpi({
  label,
  value,
  hint,
  hintClass = "text-[color:var(--muted)]",
  icon: Icon,
  iconClass = "text-primary",
}: {
  label: string;
  value: React.ReactNode;
  hint: React.ReactNode;
  hintClass?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-premium">
      <div className="text-[color:var(--muted)] text-xs font-medium uppercase tracking-wider mb-2 flex justify-between items-center">
        {label} <Icon className={`w-4 h-4 ${iconClass}`} />
      </div>
      <div className="text-3xl font-bold">{value}</div>
      <div className={`text-xs mt-2 flex items-center gap-1 ${hintClass}`}>{hint}</div>
    </div>
  );
}

export function Dashboard({ state }: { state: ProjectState }) {
  const { health, cpi, spi, safetyScore, alerts, safetyKpis, project } = state;

  // Simple projection curve derived from cpi/spi/budgetUsed for the S-curve viz
  const budgetPct = Number(String(state.budgetUsed ?? "0").replace("%", "")) || 0;
  const data = Array.from({ length: 8 }).map((_, i) => {
    const t = i / 7;
    return {
      week: `W${i + 1}`,
      planned: Math.round(t * 100),
      actual: Math.round(t * budgetPct + t * 100 * (1 - t) * ((cpi ?? 1) - 1) * 0.4 * 100) / 100,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Executive Command Center</h1>
          <p className="text-[color:var(--muted)] text-sm mt-1">
            Real-time intelligence for {project?.projectName}
          </p>
        </div>
        <button className="px-4 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-border transition flex items-center gap-2">
          <Download className="w-4 h-4" /> Export Brief
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi
          label="Project Health"
          value={health !== null ? `${health}%` : "—"}
          icon={Activity}
          iconClass="text-[color:var(--success)]"
          hint={
            <>
              <TrendingUp className="w-3 h-3" />{" "}
              {health === null
                ? "Not yet estimated"
                : health >= 90
                ? "Stable trajectory"
                : "Needs attention"}
            </>
          }
          hintClass={
            health !== null && health >= 90
              ? "text-[color:var(--success)]"
              : "text-[color:var(--warning)]"
          }
        />
        <Kpi
          label="Cost Perf. Index"
          value={cpi ?? "—"}
          icon={DollarSign}
          hint={
            <>
              {cpi !== null && cpi >= 1 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{" "}
              {cpi === null ? "Not yet estimated" : cpi >= 1 ? "Under budget" : "Over budget"}
            </>
          }
          hintClass={
            cpi !== null && cpi >= 1
              ? "text-[color:var(--success)]"
              : "text-[color:var(--warning)]"
          }
        />
        <Kpi
          label="Schedule Perf."
          value={spi ?? "—"}
          icon={Clock}
          iconClass="text-[color:var(--warning)]"
          hint={
            <>
              <AlertCircle className="w-3 h-3" />{" "}
              {spi === null
                ? "Not yet estimated"
                : spi >= 1
                ? "On or ahead of schedule"
                : "Behind schedule"}
            </>
          }
          hintClass={
            spi !== null && spi >= 1
              ? "text-[color:var(--success)]"
              : "text-[color:var(--warning)]"
          }
        />
        <Kpi
          label="Safety Score"
          value={safetyScore !== null ? `${safetyScore}/100` : "—"}
          icon={ShieldCheck}
          iconClass="text-[color:var(--success)]"
          hint={
            safetyKpis?.hasLostTimeIncident
              ? "High-severity incident logged"
              : "No high-severity incidents"
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-surface border border-border rounded-xl flex flex-col shadow-premium h-[400px]">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">AI Copilot Insights</h3>
          </div>
          <div className="p-4 flex-1 overflow-y-auto space-y-4">
            {alerts.length === 0 ? (
              <p className="text-sm text-[color:var(--muted)]">
                No AI alerts yet. Ask the Copilot for a project summary to
                generate initial insights.
              </p>
            ) : (
              alerts.map((a, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      a.type === "warning"
                        ? "bg-[color:var(--warning)]"
                        : a.type === "danger"
                        ? "bg-[color:var(--danger)]"
                        : "bg-[color:var(--success)]"
                    }`}
                  />
                  <p className="text-sm leading-relaxed">{a.text}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-5 shadow-premium h-[400px] flex flex-col">
          <h3 className="font-semibold text-sm mb-4">Cost Variance Forecast (S-Curve)</h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.905 0.017 80)" />
                <XAxis dataKey="week" fontSize={11} stroke="oklch(0.51 0.014 65)" />
                <YAxis fontSize={11} stroke="oklch(0.51 0.014 65)" />
                <Tooltip contentStyle={{ background: "white", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="planned" stroke="oklch(0.51 0.014 65)" strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="actual" stroke="oklch(0.66 0.13 40)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
