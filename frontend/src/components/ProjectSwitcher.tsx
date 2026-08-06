import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Check, Loader2, FolderOpen } from "lucide-react";
import { useProjects, useLoadProject } from "@/hooks/use-project";

/**
 * Header project switcher. Lists every project saved in the database and lets the
 * user jump between them; "New project" is what opens the setup wizard.
 */
export function ProjectSwitcher({
  activeName,
  onNewProject,
}: {
  activeName: string;
  onNewProject: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const { data: projects, isLoading, error, refetch } = useProjects();
  const load = useLoadProject();

  useEffect(() => {
    if (!open) return;
    refetch();
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, refetch]);

  const pick = async (id: string) => {
    await load.mutateAsync(id).catch(() => undefined);
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrap}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-md border border-border hover:border-primary transition"
      >
        <div className="w-2 h-2 rounded-full bg-[color:var(--success)]" />
        <span className="text-sm font-medium">{activeName}</span>
        {load.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[color:var(--muted)]" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-80 bg-surface border border-border rounded-xl shadow-xl overflow-hidden z-30">
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)] border-b border-border flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5" /> Your projects
          </div>

          <div className="max-h-72 overflow-y-auto">
            {isLoading && (
              <div className="px-3 py-4 text-xs text-[color:var(--muted)] flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading projects…
              </div>
            )}

            {error && (
              <div className="px-3 py-4 text-xs text-[color:var(--danger)]">
                Saved projects are unavailable ({error.message}).
              </div>
            )}

            {!isLoading && !error && (projects?.length ?? 0) === 0 && (
              <div className="px-3 py-4 text-xs text-[color:var(--muted)]">
                No saved projects yet.
              </div>
            )}

            {projects?.map((p) => {
              const name = p.project?.projectName ?? "Untitled project";
              const isActive = name === activeName;
              return (
                <button
                  key={p.id}
                  onClick={() => pick(p.id)}
                  disabled={load.isPending}
                  className="w-full text-left px-3 py-2.5 hover:bg-background transition flex items-start gap-2 disabled:opacity-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{name}</div>
                    <div className="text-[11px] text-[color:var(--muted)] truncate">
                      {[p.project?.client, p.project?.location].filter(Boolean).join(" • ") ||
                        "—"}
                    </div>
                    <div className="text-[10px] text-[color:var(--muted)] mt-0.5">
                      Updated {new Date(p.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  {isActive && <Check className="w-4 h-4 text-primary mt-0.5" />}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              onNewProject();
            }}
            className="w-full px-3 py-3 border-t border-border text-sm font-medium text-primary hover:bg-primary/5 transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New project
          </button>
        </div>
      )}
    </div>
  );
}
