import { useState } from "react";
import type { NotificationRecord, WorkflowItem } from "@/lib/types";
import {
  useUpsertWorkflow,
  useDeleteWorkflow,
  useEscalationScan,
} from "@/hooks/use-project";
import { Plus, Trash2, BellRing, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";

const COLUMNS: Array<{ id: string; label: string }> = [
  { id: "Open", label: "Open" },
  { id: "In Progress", label: "In progress" },
  { id: "Resolved", label: "Resolved" },
];

const NEXT: Record<string, string> = { Open: "In Progress", "In Progress": "Resolved" };

export function WorkflowBoard({
  workflows,
  notifications,
}: {
  workflows: WorkflowItem[];
  notifications: NotificationRecord[];
}) {
  const upsert = useUpsertWorkflow();
  const remove = useDeleteWorkflow();
  const scan = useEscalationScan();
  const [task, setTask] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("Medium");

  const add = () => {
    if (!task.trim()) return;
    upsert.mutate({ task: task.trim(), assignedTo: owner.trim() || "Unassigned", dueDate: due, priority });
    setTask("");
    setOwner("");
    setDue("");
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-xl shadow-premium">
        <div className="p-5 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-sm">Mitigation Workflow & Escalation</h3>
            <p className="text-xs text-[color:var(--muted)] mt-0.5">
              Assign mitigations, track them to closure, and auto-escalate threshold breaches.
            </p>
          </div>
          <button
            onClick={() => scan.mutate()}
            disabled={scan.isPending}
            className="px-3 py-2 bg-[color:var(--warning)]/10 text-[color:var(--warning)] border border-[color:var(--warning)]/30 rounded-lg text-xs font-medium hover:bg-[color:var(--warning)]/20 transition flex items-center gap-2 disabled:opacity-60"
          >
            {scan.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <BellRing className="w-3.5 h-3.5" />
            )}
            Run escalation scan
          </button>
        </div>

        {/* new task */}
        <div className="p-4 border-b border-border grid grid-cols-1 md:grid-cols-[1fr_150px_140px_120px_auto] gap-2">
          <input
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Mitigation task (e.g. install edge protection on level 3)"
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Owner"
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
          <button
            onClick={add}
            disabled={upsert.isPending || !task.trim()}
            className="px-3 py-2 bg-[color:var(--text-main)] text-surface rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>

        {/* board */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const items = workflows.filter(
              (w) => (w.status || "Open").toLowerCase() === col.id.toLowerCase(),
            );
            return (
              <div key={col.id} className="bg-background border border-border rounded-xl p-3">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-[color:var(--muted)] font-semibold mb-2">
                  <span>{col.label}</span>
                  <span className="tabular-nums">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 && (
                    <p className="text-xs text-[color:var(--muted)] py-3 text-center">Nothing here</p>
                  )}
                  {items.map((w) => (
                    <div key={w.id} className="bg-surface border border-border rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium leading-snug">{w.task}</p>
                        <button
                          onClick={() => remove.mutate(w.id)}
                          className="text-[color:var(--muted)] hover:text-[color:var(--danger)]"
                          aria-label="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-[10px] text-[color:var(--muted)] mt-1.5">
                        {w.assignedTo} · {w.priority} · {w.dueDate || "no due date"}
                      </div>
                      {NEXT[w.status] && (
                        <button
                          onClick={() => upsert.mutate({ id: w.id, status: NEXT[w.status] })}
                          className="mt-2 w-full text-[11px] flex items-center justify-center gap-1 border border-border rounded-md py-1.5 hover:border-primary/60 transition"
                        >
                          {NEXT[w.status] === "Resolved" ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <ArrowRight className="w-3 h-3" />
                          )}
                          Move to {NEXT[w.status]}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {notifications.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <h4 className="font-semibold text-sm mb-3">Notification log</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-3 bg-background border border-border rounded-lg p-3"
              >
                <span
                  className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                    n.level === "critical"
                      ? "bg-[color:var(--danger)]"
                      : n.level === "warning"
                      ? "bg-[color:var(--warning)]"
                      : "bg-primary"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium">{n.title}</p>
                  {n.body && (
                    <p className="text-[11px] text-[color:var(--muted)] mt-0.5">{n.body}</p>
                  )}
                  <p className="text-[10px] text-[color:var(--muted)] mt-1">
                    {new Date(n.createdAt).toLocaleString()} · via {n.delivered.join(", ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
