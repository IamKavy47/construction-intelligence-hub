import { MODULES } from "@/lib/modules";
import type { ModuleId } from "@/lib/types";
import * as Icons from "lucide-react";
import { Layers } from "lucide-react";

interface Props {
  active: ModuleId;
  onSelect: (id: ModuleId) => void;
}

export function Sidebar({ active, onSelect }: Props) {
  return (
    <aside className="w-64 border-r border-border bg-background flex flex-col flex-shrink-0 h-full">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <div className="flex items-center gap-2 font-semibold">
          <Layers className="text-primary w-5 h-5" />
          <span>Intelligence Hub</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {MODULES.map((m) => {
          const Icon =
            (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[m.icon] ??
            Icons.Circle;
          const isActive = active === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-all ${
                isActive
                  ? "bg-surface font-medium text-[color:var(--text-main)]"
                  : "text-[color:var(--muted)] hover:bg-surface hover:text-[color:var(--text-main)]"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-primary" : ""}`} />
              <span>{m.name}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 bg-surface p-3 rounded-xl border border-border">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-medium text-sm">
            KP
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Kavy Porwal</p>
            <p className="text-xs text-[color:var(--muted)] truncate">
              Principal Architect
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
