import type { RiskEngine } from "@/lib/types";
import { useRiskEngine } from "@/hooks/use-project";
import {
  Brain,
  Loader2,
  Sparkles,
  Repeat2,
  TrendingUp,
  ListChecks,
  CircleAlert,
} from "lucide-react";

const LABELS: Record<string, string> = {
  riskRegister: "Risk register",
  safety: "Safety events",
  ppeCompliance: "PPE compliance",
  schedule: "Schedule health",
  materials: "Material supply",
  weather: "Weather exposure",
};

function gradeTone(grade: string) {
  const g = grade.toLowerCase();
  if (g === "critical" || g === "high") return "text-[color:var(--danger)] bg-[color:var(--danger)]/10";
  if (g === "moderate") return "text-[color:var(--warning)] bg-[color:var(--warning)]/10";
  return "text-[color:var(--success)] bg-[color:var(--success)]/10";
}

export function RiskEngineCard({ engine }: { engine?: RiskEngine | null }) {
  const run = useRiskEngine();

  return (
    <div className="bg-surface border border-border rounded-xl shadow-premium overflow-hidden">
      <div className="p-5 border-b border-border flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <span className="p-2 rounded-lg bg-primary/10 text-primary">
            <Brain className="w-5 h-5" />
          </span>
          <div>
            <h3 className="font-semibold text-sm">Construction Risk Intelligence Engine</h3>
            <p className="text-xs text-[color:var(--muted)] mt-0.5">
              Weighted site risk score, recurring patterns and predicted incidents.
            </p>
          </div>
        </div>
        <button
          onClick={() => run.mutate()}
          disabled={run.isPending}
          className="px-3 py-2 bg-[color:var(--text-main)] text-surface rounded-lg text-xs font-medium hover:opacity-90 transition flex items-center gap-2 disabled:opacity-60"
        >
          {run.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          Run engine
        </button>
      </div>

      {!engine ? (
        <div className="p-8 text-center text-sm text-[color:var(--muted)]">
          No intelligence run yet. Click <b>Run engine</b> to score this site and mine recurring
          patterns from project history.
        </div>
      ) : (
        <div className="p-5 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
          {/* Score */}
          <div className="space-y-3">
            <div className="bg-background border border-border rounded-xl p-4 text-center">
              <div className="text-[10px] uppercase tracking-wide text-[color:var(--muted)]">
                Composite site risk
              </div>
              <div className="text-4xl font-bold tabular-nums mt-1">{engine.score}</div>
              <span
                className={`inline-block mt-2 text-[11px] px-2 py-1 rounded-full font-medium ${gradeTone(engine.grade)}`}
              >
                {engine.grade} risk
              </span>
              <div className="text-[10px] text-[color:var(--muted)] mt-2">
                {new Date(engine.generatedAt).toLocaleString()}
              </div>
            </div>
            <div className="space-y-2">
              {engine.components.map((c) => (
                <div key={c.name}>
                  <div className="flex justify-between text-[11px] text-[color:var(--muted)]">
                    <span>{LABELS[c.name] ?? c.name}</span>
                    <span className="tabular-nums">{c.value}</span>
                  </div>
                  <div className="h-1.5 bg-background rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(100, c.value)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Intelligence */}
          <div className="space-y-5 min-w-0">
            <div>
              <SectionTitle icon={<TrendingUp className="w-3.5 h-3.5" />} text="Outlook" />
              <p className="text-sm leading-relaxed mt-1">{engine.outlook}</p>
            </div>

            {engine.topDrivers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {engine.topDrivers.map((d, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2 py-1 rounded-full bg-background border border-border"
                  >
                    {d}
                  </span>
                ))}
              </div>
            )}

            {engine.predictedIncidents.length > 0 && (
              <div>
                <SectionTitle
                  icon={<CircleAlert className="w-3.5 h-3.5" />}
                  text="Predicted incidents"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  {engine.predictedIncidents.map((p, i) => (
                    <div key={i} className="bg-background border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">{p.type}</span>
                        <span className="text-[10px] text-[color:var(--muted)]">{p.window}</span>
                      </div>
                      <div className="text-[10px] mt-1 text-[color:var(--muted)]">
                        Likelihood: {p.likelihood}
                      </div>
                      <p className="text-xs mt-1.5 leading-snug">{p.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {engine.patterns.filter((p) => p.recurring).length > 0 && (
              <div>
                <SectionTitle
                  icon={<Repeat2 className="w-3.5 h-3.5" />}
                  text="Recurring patterns (history)"
                />
                <div className="mt-2 divide-y divide-border border border-border rounded-lg overflow-hidden">
                  {engine.patterns
                    .filter((p) => p.recurring)
                    .slice(0, 6)
                    .map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-xs bg-background/50"
                      >
                        <span className="truncate">
                          <span className="uppercase text-[9px] text-[color:var(--muted)] mr-2">
                            {p.kind}
                          </span>
                          {p.label}
                        </span>
                        <span className="text-[10px] text-[color:var(--muted)] whitespace-nowrap tabular-nums">
                          {p.occurrences}× · {p.projectsAffected} project(s)
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {engine.recommendations.length > 0 && (
              <div>
                <SectionTitle
                  icon={<ListChecks className="w-3.5 h-3.5" />}
                  text="AI recommendations"
                />
                <ul className="mt-2 space-y-2">
                  {engine.recommendations.map((r, i) => (
                    <li
                      key={i}
                      className="bg-background border border-border rounded-lg p-3 text-xs"
                    >
                      <div className="font-medium">{r.action}</div>
                      <div className="text-[10px] text-[color:var(--muted)] mt-1">
                        {[r.owner, r.priority && `${r.priority} priority`, r.impact]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold text-[color:var(--muted)]">
      {icon}
      {text}
    </div>
  );
}
