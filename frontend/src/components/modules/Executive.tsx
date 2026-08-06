import type { ExecutiveSummary } from "@/lib/types";
import { useExecutiveSummary, useExportPdf } from "@/hooks/use-project";
import {
  Loader2,
  Download,
  RefreshCw,
  ShieldCheck,
  Gauge,
  HardHat,
  Boxes,
  FileCheck2,
  Umbrella,
} from "lucide-react";

export function Executive({ onAskCopilot }: { onAskCopilot: (q: string) => void }) {
  const { data, isLoading, error, refetch, isFetching } = useExecutiveSummary();
  const exportPdf = useExportPdf();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Executive View</h1>
          <p className="text-[color:var(--muted)] text-sm mt-1">
            Owner, compliance and insurance dashboard — aggregated from every module.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-xs font-medium hover:border-primary transition flex items-center gap-2"
          >
            {isFetching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Refresh
          </button>
          <button
            onClick={() => exportPdf.mutate("executive-summary")}
            disabled={exportPdf.isPending}
            className="px-4 py-2 bg-[color:var(--text-main)] text-surface rounded-lg text-sm font-medium hover:opacity-90 transition flex items-center gap-2 disabled:opacity-60"
          >
            {exportPdf.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export audit PDF
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="bg-surface border border-border rounded-xl p-12 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}
      {error && (
        <div className="bg-surface border border-border rounded-xl p-6 text-sm text-[color:var(--danger)]">
          {error.message}
        </div>
      )}
      {data && <Body s={data} onAskCopilot={onAskCopilot} />}
    </div>
  );
}

function Body({ s, onAskCopilot }: { s: ExecutiveSummary; onAskCopilot: (q: string) => void }) {
  const kpis = [
    { label: "Health", value: s.health ?? "--", icon: <Gauge className="w-4 h-4" /> },
    { label: "CPI", value: s.cpi ?? "--", icon: <Gauge className="w-4 h-4" /> },
    { label: "SPI", value: s.spi ?? "--", icon: <Gauge className="w-4 h-4" /> },
    { label: "Safety score", value: s.safetyScore ?? "--", icon: <HardHat className="w-4 h-4" /> },
    { label: "Budget used", value: s.budgetUsed ?? "--", icon: <Boxes className="w-4 h-4" /> },
    { label: "Schedule", value: `${s.schedule.progress}%`, icon: <FileCheck2 className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-[color:var(--muted)]">
              {k.icon}
              <span className="text-[10px] uppercase tracking-wide">{k.label}</span>
            </div>
            <div className="text-xl font-bold mt-1.5 tabular-nums">{String(k.value)}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* risk */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-premium">
          <h3 className="font-semibold text-sm mb-3">Risk posture</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">{s.risk.score}</span>
            <span className="text-xs text-[color:var(--muted)]">{s.risk.grade}</span>
          </div>
          <div className="mt-4 space-y-2">
            {s.risk.components.map((c) => (
              <div key={c.name}>
                <div className="flex justify-between text-[11px] text-[color:var(--muted)]">
                  <span>{c.name}</span>
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

        {/* compliance */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-premium">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> Compliance
            </h3>
            <span className="text-xs text-[color:var(--muted)]">
              avg {s.compliance.averageScore ?? "--"}
            </span>
          </div>
          <div className="space-y-2">
            {s.compliance.items.map((c) => (
              <div key={c.id} className="bg-background border border-border rounded-lg p-3">
                <div className="text-xs font-medium">{c.standard}</div>
                <div className="text-[10px] text-[color:var(--muted)] mt-1">
                  {c.status} · score {c.score} · checked {c.lastChecked}
                </div>
              </div>
            ))}
            {s.compliance.items.length === 0 && (
              <p className="text-xs text-[color:var(--muted)]">No compliance items.</p>
            )}
          </div>
        </div>

        {/* insurance + safety */}
        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-xl p-5 shadow-premium">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
              <Umbrella className="w-4 h-4 text-primary" /> Insurance exposure
            </h3>
            <div className="text-2xl font-bold tabular-nums">
              {s.insurance.totalExposure.toLocaleString()}
            </div>
            <div className="mt-3 space-y-2">
              {s.insurance.claims.map((c) => (
                <div key={c.id} className="text-xs bg-background border border-border rounded-lg p-2.5">
                  <div className="font-medium">{c.claimType}</div>
                  <div className="text-[10px] text-[color:var(--muted)] mt-0.5">
                    {c.id} · {c.status} · {c.exposureValuation.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 shadow-premium">
            <h3 className="font-semibold text-sm mb-3">Safety & supply</h3>
            <dl className="text-xs space-y-1.5">
              <Row label="PPE check-ins" value={s.safety.ppeChecks} />
              <Row label="PPE violations" value={s.safety.ppeViolations} />
              <Row label="Incidents logged" value={s.safety.kpis?.totalIncidentsLogged ?? "--"} />
              <Row label="Materials tracked" value={s.materials.tracked} />
              <Row label="Material shortages" value={s.materials.shortages} />
              <Row label="Open mitigations" value={s.workflows.open} />
              <Row label="Reports filed" value={s.reportsFiled} />
            </dl>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-2">Board-ready narrative</h3>
        <p className="text-xs text-[color:var(--muted)]">
          Ask the AI to turn this aggregation into a client- or board-facing update.
        </p>
        <button
          onClick={() =>
            onAskCopilot(
              "Write an executive update for the client board: project health, schedule position, composite risk score, safety performance, compliance status and the three decisions you need from them.",
            )
          }
          className="mt-3 text-xs bg-background border border-border px-3 py-2 rounded-lg hover:border-primary/50 transition"
        >
          Draft executive update
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-[color:var(--muted)]">{label}</dt>
      <dd className="font-medium tabular-nums">{String(value)}</dd>
    </div>
  );
}
