import { Layers, Plus, AlertTriangle } from "lucide-react";

export function WelcomeScreen({
  onNew,
  error,
}: {
  onNew: () => void;
  error?: string | null;
}) {
  return (
    <div className="absolute inset-0 z-40 bg-background flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-surface border border-border rounded-2xl flex items-center justify-center mx-auto shadow-premium">
          <Layers className="text-primary w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold mb-2">
            Construction Intelligence Hub
          </h1>
          <p className="text-[color:var(--muted)] text-sm">
            AI-powered construction project intelligence platform.
          </p>
        </div>
        {error && (
          <div className="bg-[color:var(--danger)]/10 border border-[color:var(--danger)]/30 text-[color:var(--danger)] text-sm rounded-lg px-4 py-3 flex items-start gap-2 text-left">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Backend not reachable</p>
              <p className="text-xs opacity-80 mt-1">{error}</p>
              <p className="text-xs opacity-80 mt-1">
                Start FastAPI with <code>python app.py</code> on the same
                machine you're viewing the preview from.
              </p>
            </div>
          </div>
        )}
        <button
          onClick={onNew}
          className="bg-[color:var(--text-main)] text-surface px-6 py-3 rounded-lg w-full font-medium hover:bg-black transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>
    </div>
  );
}
