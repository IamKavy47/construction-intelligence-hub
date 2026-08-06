import { useMemo, useState } from "react";
import type { ProjectState, TimelinePhase } from "@/lib/types";
import {
  Siren,
  Loader2,
  Sparkles,
  CalendarDays,
  Flag,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Activity,
  ZoomIn,
  ZoomOut,
  LayoutList,
  GanttChartSquare,
  X,
  MessageSquare,
} from "lucide-react";
import { useOptimizeTimeline } from "@/hooks/use-project";

const FALLBACK: TimelinePhase[] = [
  { name: "Planning & Permits", start: 0, length: 1.2, status: "complete", progress: 100 },
  { name: "Site Prep & Substructure", start: 1, length: 1.5, status: "complete", progress: 100 },
  { name: "Superstructure", start: 2, length: 2, status: "active", progress: 45 },
  { name: "Facade & Cladding", start: 3, length: 1.8, status: "planned", risk: "High" },
  { name: "MEP Rough-in", start: 3.2, length: 1.6, status: "planned" },
  { name: "Interior Fit-Out", start: 4, length: 1.5, status: "planned" },
  { name: "Handover", start: 4.6, length: 0.4, status: "planned" },
];

type Filter = "all" | "complete" | "active" | "planned" | "risk";

const statusStyles: Record<
  string,
  { bar: string; dot: string; chip: string; label: string }
> = {
  complete: {
    bar: "from-[color:var(--success)]/70 to-[color:var(--success)]/40 border-[color:var(--success)]/60",
    dot: "bg-[color:var(--success)]",
    chip: "bg-[color:var(--success)]/12 text-[color:var(--success)] border-[color:var(--success)]/30",
    label: "Complete",
  },
  active: {
    bar: "from-primary/80 to-primary/45 border-primary/70",
    dot: "bg-primary",
    chip: "bg-primary/12 text-primary border-primary/30",
    label: "In progress",
  },
  planned: {
    bar: "from-[color:var(--muted)]/35 to-[color:var(--muted)]/15 border-border",
    dot: "bg-[color:var(--muted)]",
    chip: "bg-background text-[color:var(--muted)] border-border",
    label: "Planned",
  },
  atrisk: {
    bar: "from-[color:var(--danger)]/65 to-[color:var(--danger)]/30 border-[color:var(--danger)]/60",
    dot: "bg-[color:var(--danger)]",
    chip: "bg-[color:var(--danger)]/12 text-[color:var(--danger)] border-[color:var(--danger)]/30",
    label: "At risk",
  },
};

function styleFor(p: TimelinePhase) {
  if (p.status === "planned" && (p.risk === "High" || p.risk === "Medium")) {
    return statusStyles.atrisk;
  }
  return statusStyles[p.status] ?? statusStyles.planned;
}

function weekToDate(startDate: string | undefined, week: number) {
  if (!startDate) return null;
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + Math.round(week * 7));
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function Timeline({
  state,
  onAskCopilot,
}: {
  state: ProjectState;
  onAskCopilot: (q: string) => void;
}) {
  const opt = useOptimizeTimeline();
  const [zoom, setZoom] = useState(72); // px per week
  const [view, setView] = useState<"gantt" | "list">("gantt");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const phases = state.timeline && state.timeline.length > 0 ? state.timeline : FALLBACK;
  const startDate = state.project?.startDate;

  const totalWeeks = useMemo(
    () => Math.max(5, Math.ceil(Math.max(...phases.map((p) => p.start + p.length)))),
    [phases],
  );

  const stats = useMemo(() => {
    const totalLen = phases.reduce((s, p) => s + p.length, 0) || 1;
    const done = phases.reduce(
      (s, p) => s + (p.length * (p.status === "complete" ? 100 : p.progress ?? 0)) / 100,
      0,
    );
    return {
      progress: Math.round((done / totalLen) * 100),
      complete: phases.filter((p) => p.status === "complete").length,
      active: phases.filter((p) => p.status === "active").length,
      atRisk: phases.filter((p) => p.risk === "High" || p.risk === "Medium").length,
    };
  }, [phases]);

  // "Today" marker: end of the last completed phase / progress point of active phase
  const todayWeek = useMemo(() => {
    const active = phases.find((p) => p.status === "active");
    if (active) return active.start + (active.length * (active.progress ?? 0)) / 100;
    const lastDone = [...phases].filter((p) => p.status === "complete").pop();
    return lastDone ? lastDone.start + lastDone.length : 0;
  }, [phases]);

  const visible = phases
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => {
      if (filter === "all") return true;
      if (filter === "risk") return p.risk === "High" || p.risk === "Medium";
      return p.status === filter;
    });

  const gridWidth = totalWeeks * zoom;
  const sel = selected !== null ? phases[selected] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
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
          className="px-4 py-2 bg-[color:var(--text-main)] text-surface rounded-lg text-sm font-medium hover:opacity-90 transition flex items-center gap-2 disabled:opacity-60"
        >
          {opt.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Re-optimize with AI
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Overall progress"
          value={`${stats.progress}%`}
          tint="primary"
          bar={stats.progress}
        />
        <StatCard
          icon={<CheckCircle2 className="w-4 h-4" />}
          label="Phases complete"
          value={`${stats.complete} / ${phases.length}`}
          tint="success"
        />
        <StatCard
          icon={<Activity className="w-4 h-4" />}
          label="Active now"
          value={String(stats.active)}
          tint="primary"
        />
        <StatCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="At-risk phases"
          value={String(stats.atRisk)}
          tint={stats.atRisk > 0 ? "danger" : "muted"}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["all", "All phases"],
              ["active", "In progress"],
              ["planned", "Planned"],
              ["complete", "Complete"],
              ["risk", "At risk"],
            ] as [Filter, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                filter === id
                  ? "bg-[color:var(--text-main)] text-surface border-transparent"
                  : "bg-surface border-border text-[color:var(--muted)] hover:text-[color:var(--text-main)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setZoom((z) => Math.max(40, z - 16))}
              className="p-2 hover:bg-background transition"
              aria-label="Zoom out timeline"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs text-[color:var(--muted)] tabular-nums">
              {totalWeeks}w
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(160, z + 16))}
              className="p-2 hover:bg-background transition"
              aria-label="Zoom in timeline"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center bg-surface border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setView("gantt")}
              className={`p-2 transition ${view === "gantt" ? "bg-[color:var(--text-main)] text-surface" : "hover:bg-background"}`}
              aria-label="Gantt view"
            >
              <GanttChartSquare className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-2 transition ${view === "list" ? "bg-[color:var(--text-main)] text-surface" : "hover:bg-background"}`}
              aria-label="List view"
            >
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Chart / list */}
        {view === "gantt" ? (
          <div className="bg-surface border border-border rounded-xl shadow-premium overflow-hidden animate-fade-in">
            <div className="overflow-x-auto">
              <div className="min-w-max">
                {/* week header */}
                <div className="flex border-b border-border bg-background/60 sticky top-0 z-10">
                  <div className="w-56 flex-shrink-0 p-3 border-r border-border text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Phase
                  </div>
                  <div className="flex" style={{ width: gridWidth }}>
                    {Array.from({ length: totalWeeks }).map((_, i) => {
                      const isNow = todayWeek >= i && todayWeek < i + 1;
                      return (
                        <div
                          key={i}
                          style={{ width: zoom }}
                          className={`px-1 py-2.5 text-center border-r border-border last:border-0 ${
                            isNow ? "bg-primary/8 text-primary" : "text-[color:var(--muted)]"
                          }`}
                        >
                          <div className="text-[11px] font-semibold">W{i + 1}</div>
                          {zoom >= 64 && (
                            <div className="text-[9px] opacity-70">
                              {weekToDate(startDate, i) ?? ""}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* rows */}
                <div className="relative">
                  {/* today line */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-primary/70 z-20 pointer-events-none"
                    style={{ left: `calc(14rem + ${(todayWeek / totalWeeks) * gridWidth}px)` }}
                  >
                    <div className="absolute -top-0 -left-[3px] w-[7px] h-[7px] rounded-full bg-primary" />
                  </div>

                  {visible.map(({ p, i }) => {
                    const s = styleFor(p);
                    const isSel = selected === i;
                    return (
                      <div
                        key={i}
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered(null)}
                        className={`flex border-b border-border last:border-0 h-[58px] transition-colors ${
                          isSel ? "bg-primary/6" : hovered === i ? "bg-background/70" : ""
                        }`}
                      >
                        <div className="w-56 flex-shrink-0 px-3 border-r border-border flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{p.name}</div>
                            <div className="text-[10px] text-[color:var(--muted)]">
                              {p.length.toFixed(1)}w · {s.label}
                            </div>
                          </div>
                        </div>
                        <div className="relative flex" style={{ width: gridWidth }}>
                          {Array.from({ length: totalWeeks }).map((_, c) => (
                            <div
                              key={c}
                              style={{ width: zoom }}
                              className="border-r border-border/40 last:border-0"
                            />
                          ))}
                          <button
                            onClick={() => setSelected(isSel ? null : i)}
                            className={`group absolute top-1/2 -translate-y-1/2 h-8 rounded-lg border bg-gradient-to-r ${s.bar} shadow-sm hover:h-9 transition-all duration-200 overflow-hidden text-left ${
                              isSel ? "ring-2 ring-primary/60" : ""
                            }`}
                            style={{
                              left: (p.start / totalWeeks) * gridWidth,
                              width: Math.max(18, (p.length / totalWeeks) * gridWidth),
                            }}
                            title={`${p.name} — ${s.label}${p.progress != null ? ` · ${p.progress}%` : ""}`}
                          >
                            {typeof p.progress === "number" && p.progress > 0 && (
                              <span
                                className="absolute inset-y-0 left-0 bg-[color:var(--text-main)]/12"
                                style={{ width: `${Math.min(100, p.progress)}%` }}
                              />
                            )}
                            <span className="relative px-2 text-[10px] font-semibold text-[color:var(--text-main)]/80 whitespace-nowrap">
                              {p.progress != null ? `${p.progress}%` : ""}
                            </span>
                          </button>
                          {p.length <= 0.5 && (
                            <Flag
                              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 text-primary pointer-events-none"
                              style={{ left: (p.start / totalWeeks) * gridWidth - 14 }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {visible.length === 0 && (
                    <div className="p-8 text-center text-sm text-[color:var(--muted)]">
                      No phases match this filter.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* legend */}
            <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-t border-border bg-background/40 text-[11px] text-[color:var(--muted)]">
              {["complete", "active", "planned", "atrisk"].map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-sm ${statusStyles[k].dot}`} />
                  {statusStyles[k].label}
                </span>
              ))}
              <span className="flex items-center gap-1.5 ml-auto">
                <span className="w-px h-3 bg-primary" /> Today
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-in">
            {visible.map(({ p, i }) => {
              const s = styleFor(p);
              return (
                <button
                  key={i}
                  onClick={() => setSelected(selected === i ? null : i)}
                  className={`w-full text-left bg-surface border rounded-xl p-4 hover:shadow-premium transition ${
                    selected === i ? "border-primary/60" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-sm">{p.name}</div>
                      <div className="text-xs text-[color:var(--muted)] mt-0.5 flex items-center gap-1.5">
                        <CalendarDays className="w-3 h-3" />
                        Week {p.start + 1}–{(p.start + p.length).toFixed(1)} · {p.length.toFixed(1)}w
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full border ${s.chip}`}>
                      {s.label}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 bg-background rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.dot}`}
                      style={{ width: `${Math.min(100, p.progress ?? (p.status === "complete" ? 100 : 0))}%` }}
                    />
                  </div>
                  {p.note && (
                    <p className="text-xs text-[color:var(--muted)] mt-2">{p.note}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Side panel */}
        <div className="space-y-4">
          {sel ? (
            <div className="bg-surface border border-border rounded-xl p-4 animate-scale-in">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[color:var(--muted)]">
                    Phase detail
                  </div>
                  <h4 className="font-semibold mt-0.5">{sel.name}</h4>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1 rounded-md hover:bg-background text-[color:var(--muted)]"
                  aria-label="Close phase detail"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <Detail label="Status" value={styleFor(sel).label} />
                <Detail label="Duration" value={`${sel.length.toFixed(1)} weeks`} />
                <Detail
                  label="Starts"
                  value={weekToDate(startDate, sel.start) ?? `Week ${sel.start + 1}`}
                />
                <Detail
                  label="Ends"
                  value={
                    weekToDate(startDate, sel.start + sel.length) ??
                    `Week ${(sel.start + sel.length).toFixed(1)}`
                  }
                />
                <Detail label="Progress" value={`${sel.progress ?? 0}%`} />
                <Detail label="Risk" value={sel.risk ?? "—"} />
              </div>

              {sel.note && (
                <p className="mt-3 text-xs text-[color:var(--muted)] bg-background rounded-lg p-2.5 border border-border">
                  {sel.note}
                </p>
              )}

              <button
                onClick={() =>
                  onAskCopilot(
                    `Analyze the "${sel.name}" phase of this project (week ${sel.start + 1} to ${(sel.start + sel.length).toFixed(1)}, ${sel.progress ?? 0}% complete, risk: ${sel.risk ?? "unknown"}). What are the delay drivers, dependencies and the fastest way to protect this phase?`,
                  )
                }
                className="mt-4 w-full flex items-center justify-center gap-2 text-xs bg-[color:var(--text-main)] text-surface px-3 py-2 rounded-lg hover:opacity-90 transition"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Ask AI about this phase
              </button>
            </div>
          ) : (
            <div className="bg-surface border border-border border-dashed rounded-xl p-5 text-center">
              <GanttChartSquare className="w-5 h-5 mx-auto text-[color:var(--muted)]" />
              <p className="text-xs text-[color:var(--muted)] mt-2">
                Select any phase bar to inspect dates, progress and risk — and ask the AI about it.
              </p>
            </div>
          )}

          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-[color:var(--warning)]/10 rounded-lg text-[color:var(--warning)] flex-shrink-0">
                <Siren className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">Delay Risk Analysis</h4>
                <p className="text-xs text-[color:var(--muted)] mt-1">
                  Reason over live weather, material shortages and the risk register.
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                onAskCopilot(
                  "Analyze current risks, materials, and weather to predict potential delays and propose schedule adjustments.",
                )
              }
              className="mt-3 w-full text-xs bg-background border border-border px-3 py-2 rounded-lg hover:border-primary/50 transition"
            >
              Run Delay Risk Analysis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tint,
  bar,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: "primary" | "success" | "danger" | "muted";
  bar?: number;
}) {
  const color =
    tint === "primary"
      ? "text-primary bg-primary/10"
      : tint === "success"
      ? "text-[color:var(--success)] bg-[color:var(--success)]/10"
      : tint === "danger"
      ? "text-[color:var(--danger)] bg-[color:var(--danger)]/10"
      : "text-[color:var(--muted)] bg-background";
  return (
    <div className="bg-surface border border-border rounded-xl p-4 hover:shadow-premium transition">
      <div className="flex items-center gap-2">
        <span className={`p-1.5 rounded-md ${color}`}>{icon}</span>
        <span className="text-[11px] uppercase tracking-wide text-[color:var(--muted)]">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold mt-2 tabular-nums">{value}</div>
      {typeof bar === "number" && (
        <div className="mt-2 h-1.5 bg-background rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, bar)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background border border-border rounded-lg p-2">
      <div className="text-[10px] uppercase tracking-wide text-[color:var(--muted)]">{label}</div>
      <div className="font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}
