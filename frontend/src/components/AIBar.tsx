import { useRef, useState } from "react";
import { Paperclip, Sparkles, ArrowUp, Loader2 } from "lucide-react";
import { AI_SUGGESTIONS } from "@/lib/modules";
import type { ModuleId, ProjectInfo } from "@/lib/types";
import { useUpload } from "@/hooks/use-project";

interface Props {
  active: ModuleId;
  project: ProjectInfo | null;
  onSubmit: (text: string) => void;
  onNavigate: (m: ModuleId) => void;
  pending: boolean;
}

export function AIBar({ active, project, onSubmit, onNavigate, pending }: Props) {
  const [value, setValue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUpload();

  const suggestions = AI_SUGGESTIONS[active] ?? AI_SUGGESTIONS.default;

  const submit = () => {
    const t = value.trim();
    if (!t) return;
    onSubmit(t);
    setValue("");
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    if (!project) return;
    onNavigate("copilot");
    for (const f of Array.from(files)) {
      try {
        await upload.mutateAsync({ file: f, project });
      } catch {
        /* toast handled */
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[640px] max-w-[92%] z-20">
      <div className="glass-panel rounded-2xl shadow-float p-2 flex flex-col gap-2">
        <div className="flex items-center px-2 pt-1 gap-2 overflow-x-auto hide-scrollbar">
          <span className="text-xs font-medium text-[color:var(--muted)] flex-shrink-0">
            Suggestions:
          </span>
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => {
                if (s === "Upload a drawing for clash check") {
                  fileRef.current?.click();
                  return;
                }
                onSubmit(s);
              }}
              className="text-xs bg-surface border border-border px-3 py-1 rounded-full whitespace-nowrap hover:border-primary transition"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center bg-background rounded-xl border border-border p-1 pl-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.dwg,.dxf,.xls,.xlsx,.png,.jpg,.jpeg,.csv,.txt"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!project || upload.isPending}
            title="Upload document"
            className="p-2 text-[color:var(--muted)] hover:text-primary transition-colors rounded-lg hover:bg-surface disabled:opacity-40"
          >
            {upload.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </button>
          <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Ask Construction Copilot or upload a document..."
            className="flex-1 bg-transparent border-none focus:outline-none text-sm px-3 py-2 placeholder:text-[color:var(--muted)]"
          />
          <button
            onClick={submit}
            disabled={pending || !value.trim()}
            className="bg-[color:var(--text-main)] text-surface p-2 rounded-lg hover:bg-black transition disabled:opacity-40"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
