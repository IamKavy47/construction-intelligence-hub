import type { ProjectState } from "@/lib/types";
import { useGenerateReport, useExportPdf } from "@/hooks/use-project";
import { FileText, Loader2, Sparkles, CheckCircle2, AlertCircle, CloudRain, ShieldCheck, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function DailyReport({ state }: { state: ProjectState }) {
  const gen = useGenerateReport();
  const exportPdf = useExportPdf();
  const reports = state.dailyReports ?? [];
  const latest = reports[0];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Daily Report Generator</h1>
          <p className="text-[color:var(--muted)] text-sm mt-1">
            AI-authored Daily Progress Reports (DPR) synthesizing weather, materials, risks and safety.
          </p>
        </div>
        <div className="flex gap-2">
        {latest && (
          <button
            onClick={() => exportPdf.mutate("daily-report")}
            disabled={exportPdf.isPending}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-xs font-medium hover:border-primary transition flex items-center gap-2 disabled:opacity-60"
          >
            {exportPdf.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Export audit PDF
          </button>
        )}
        <button
          onClick={() => gen.mutate()}
          disabled={gen.isPending}
          className="px-4 py-2 bg-[color:var(--text-main)] text-surface rounded-lg text-sm font-medium hover:bg-black transition flex items-center gap-2 disabled:opacity-60"
        >
          {gen.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate Today's Report
        </button>
        </div>
      </div>

      {!latest && (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <FileText className="w-10 h-10 text-[color:var(--muted)] mx-auto mb-3" />
          <p className="text-sm text-[color:var(--muted)]">
            No reports yet. Click <b>Generate Today's Report</b> — the AI will pull weather,
            materials, risks, and safety logs into a DPR.
          </p>
        </div>
      )}

      {latest && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface border border-border rounded-xl shadow-premium">
            <div className="p-5 border-b border-border flex justify-between items-center">
              <div>
                <div className="text-xs text-[color:var(--muted)] uppercase tracking-wider">
                  Daily Progress Report
                </div>
                <h2 className="text-lg font-bold">{latest.date}</h2>
              </div>
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-medium">
                {latest.progress}
              </span>
            </div>

            <div className="p-5 space-y-6">
              <div>
                <div className="text-xs uppercase tracking-wider text-[color:var(--muted)] font-semibold mb-2">
                  Executive Summary
                </div>
                <div className="prose prose-sm max-w-none text-sm leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{latest.summary}</ReactMarkdown>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Section
                  icon={<CheckCircle2 className="w-4 h-4 text-[color:var(--success)]" />}
                  title="Work Completed"
                  items={latest.workDone}
                />
                <Section
                  icon={<FileText className="w-4 h-4 text-primary" />}
                  title="Planned Tomorrow"
                  items={latest.workPlanned}
                />
              </div>

              {latest.issues.length > 0 && (
                <Section
                  icon={<AlertCircle className="w-4 h-4 text-[color:var(--danger)]" />}
                  title="Issues / Blockers"
                  items={latest.issues}
                />
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Panel icon={<CloudRain className="w-4 h-4 text-primary" />} title="Weather Impact">
              {latest.weatherImpact}
            </Panel>
            <Panel icon={<ShieldCheck className="w-4 h-4 text-[color:var(--success)]" />} title="Safety Notes">
              {latest.safetyNotes}
            </Panel>
            {latest.aiRecommendations.length > 0 && (
              <div className="bg-surface border border-border rounded-xl p-4 shadow-premium">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold text-sm">AI Recommendations</h4>
                </div>
                <ul className="space-y-2 text-xs">
                  {latest.aiRecommendations.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span className="text-[color:var(--text-main)]">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {reports.length > 1 && (
        <div className="bg-surface border border-border rounded-xl shadow-premium">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-sm">Previous Reports</h3>
          </div>
          <div className="divide-y divide-border">
            {reports.slice(1).map((r, i) => (
              <div key={i} className="p-4 flex justify-between items-center hover:bg-background/40">
                <div>
                  <div className="text-sm font-medium">{r.date}</div>
                  <div className="text-xs text-[color:var(--muted)] line-clamp-1">{r.summary}</div>
                </div>
                <span className="text-xs text-[color:var(--muted)]">{r.progress}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <div className="text-xs uppercase tracking-wider text-[color:var(--muted)] font-semibold">
          {title}
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 leading-snug">
            <span className="text-[color:var(--muted)]">–</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-premium">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      <p className="text-xs text-[color:var(--muted)] leading-relaxed">{children}</p>
    </div>
  );
}
