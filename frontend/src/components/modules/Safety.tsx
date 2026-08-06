import type { ProjectState } from "@/lib/types";
import { WeatherWidget } from "@/components/WeatherWidget";
import { PPECheckCard } from "@/components/PPECheckCard";
import { AlertTriangle, Plus, Loader2, Sparkles } from "lucide-react";
import { useAnalyzeSafety } from "@/hooks/use-project";


export function Safety({
  state,
  onLog,
  onAskCopilot,
}: {
  state: ProjectState;
  onLog: () => void;
  onAskCopilot: (q: string) => void;
}) {
  const analyze = useAnalyzeSafety();
  const kpis = state.safetyKpis;
  const counts: Record<string, number> = {};
  state.safety
    .filter((s) => s.type !== "Audit")
    .forEach((s) => (counts[s.location] = (counts[s.location] ?? 0) + 1));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const hazards = state.safetyHazards ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Safety Intelligence</h1>
          <p className="text-[color:var(--muted)] text-sm mt-1">
            AI hazard prediction, incident tracking, compliance, weather.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              onAskCopilot("Generate today's toolbox talk based on weather, active phase and open hazards.")
            }
            className="px-3 py-2 bg-surface border border-border rounded-lg text-xs font-medium hover:border-primary transition"
          >
            Toolbox Talk
          </button>
          <button
            onClick={() => analyze.mutate()}
            disabled={analyze.isPending}
            className="px-4 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:border-primary transition flex items-center gap-2 disabled:opacity-60"
          >
            {analyze.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Predict Hazards
          </button>
          <button
            onClick={onLog}
            className="px-4 py-2 bg-[color:var(--text-main)] text-surface rounded-lg text-sm font-medium hover:bg-black transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Log Incident
          </button>
        </div>
      </div>

      <WeatherWidget report={state.weatherReport} />

      <PPECheckCard
        checks={state.ppeChecks ?? []}
        defaultLocation={state.project?.location ?? ""}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card
          label="Days Since Start"
          value={String(kpis?.daysSinceProjectStart ?? "—")}
          tone={kpis?.hasLostTimeIncident ? "warning" : "success"}
          hint={kpis?.hasLostTimeIncident ? "High-severity incident logged" : "No high-severity incidents"}
        />
        <Card
          label="Incidents Logged"
          value={String(kpis?.totalIncidentsLogged ?? state.safety.length)}
          hint={kpis?.highSeverityIncidents ? `${kpis.highSeverityIncidents} high severity` : "None high"}
        />
        <Card label="Audits" value={String(kpis?.auditsLogged ?? 0)} hint="PPE, fall protection, etc." />
        <div
          className={`bg-surface border rounded-xl p-5 shadow-premium flex flex-col justify-center ${
            top ? "bg-[color:var(--danger)]/5 border-[color:var(--danger)]/20" : "border-border"
          }`}
        >
          <div className="text-[color:var(--danger)] text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Highest-Logged Zone
          </div>
          <div className="text-sm font-semibold leading-tight">
            {top ? `${top[0]} (${top[1]} logs)` : "No incidents logged yet"}
          </div>
        </div>
      </div>

      {hazards.length > 0 && (
        <div className="bg-surface border border-border rounded-xl shadow-premium">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">AI-Predicted Hazards</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-[color:var(--muted)] uppercase bg-background/50">
                <tr>
                  <th className="px-4 py-3">Hazard</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Likelihood</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Recommended Control</th>
                </tr>
              </thead>
              <tbody>
                {hazards.map((h) => (
                  <tr key={h.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{h.hazard}</td>
                    <td className="px-4 py-3 text-xs text-[color:var(--muted)]">{h.location}</td>
                    <td className="px-4 py-3"><Sev v={h.likelihood} /></td>
                    <td className="px-4 py-3"><Sev v={h.severity} /></td>
                    <td className="px-4 py-3 text-xs">{h.control}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl shadow-premium">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-sm">Recent Safety Logs</h3>
        </div>
        {state.safety.length === 0 ? (
          <div className="p-8 text-center text-sm text-[color:var(--muted)]">
            No safety events logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-[color:var(--muted)] uppercase bg-background/50">
                <tr>
                  <th className="px-4 py-3">ID / Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Severity</th>
                </tr>
              </thead>
              <tbody>
                {state.safety.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-background/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-primary">{s.id}</div>
                      <div className="text-[10px] text-[color:var(--muted)]">{s.date}</div>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-[color:var(--muted)]">{s.type}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs">{s.desc}</div>
                      <div className="text-[10px] text-[color:var(--muted)]">{s.location}</div>
                    </td>
                    <td className="px-4 py-3"><Sev v={s.severity as "Low"|"Medium"|"High"} /></td>
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

function Sev({ v }: { v: "Low" | "Medium" | "High" | "Info" }) {
  const cls =
    v === "High"
      ? "bg-[color:var(--danger)]/10 text-[color:var(--danger)]"
      : v === "Medium"
      ? "bg-[color:var(--warning)]/10 text-[color:var(--warning)]"
      : "bg-[color:var(--success)]/10 text-[color:var(--success)]";
  return (
    <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${cls}`}>
      {v}
    </span>
  );
}

function Card({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "success" | "warning";
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-premium">
      <div className="text-[color:var(--muted)] text-xs font-medium uppercase tracking-wider mb-2">
        {label}
      </div>
      <div
        className={`text-3xl font-bold ${
          tone === "success"
            ? "text-[color:var(--success)]"
            : tone === "warning"
            ? "text-[color:var(--warning)]"
            : ""
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-[color:var(--muted)] mt-2">{hint}</div>
    </div>
  );
}
